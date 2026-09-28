// The arithmetic behind the benchmark tables, shared by report.ts and the
// site's /bench page: agent turns, missed events, needless wakes and dollars
// for every way of watching a stream. No file access here.

export const JEV_PER_TOKEN = 0.042 / 1e6;
const DAY_MIN = 24 * 60;
export const HEARTBEAT_MIN = 30;
export const HEARTBEATS = DAY_MIN / HEARTBEAT_MIN;

export interface Replayed {
  line: string;
  /** Labelled as an event the agent should react to. */
  matters: boolean;
  slice: "tuned" | "holdout" | "fresh";
  grep: boolean;
  pass: boolean;
  questions: number;
  tokens: number;
  /** With the rules before the revision (fresh events only). */
  passBefore?: boolean;
  questionsBefore?: number;
  tokensBefore?: number;
  calls?: { fn: string; question: string; value?: number; options?: Record<string, number> }[];
}

export interface Results {
  date: string;
  jev: string;
  cases: { id: string; grep: string; events: Replayed[] }[];
}

/** One headless Claude Code wake (agent.ts). */
export interface AgentRun {
  kind: "single" | "batch";
  matters: boolean[];
  claude: { total_cost_usd: number; duration_ms: number; usage: Record<string, number>; modelUsage?: Record<string, unknown> };
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** What a wake costs, from the measured runs. */
export function wakeCosts(runs: AgentRun[]) {
  const of = (kind: AgentRun["kind"]) => {
    const rs = runs.filter((r) => r.kind === kind);
    const costs = rs.map((r) => r.claude.total_cost_usd);
    return { n: rs.length, cost: mean(costs), min: Math.min(...costs), max: Math.max(...costs), ms: mean(rs.map((r) => r.claude.duration_ms)) };
  };
  const singles = runs.filter((r) => r.kind === "single");
  return {
    single: of("single"),
    batch: of("batch"),
    // A wake that acts (writes notify.log) costs more than one that decides to do nothing.
    act: mean(singles.filter((r) => r.matters[0]).map((r) => r.claude.total_cost_usd)),
    idle: mean(singles.filter((r) => !r.matters[0]).map((r) => r.claude.total_cost_usd)),
    models: [...new Set(runs.flatMap((r) => Object.keys(r.claude.modelUsage ?? {})))],
    spent: runs.reduce((s, r) => s + r.claude.total_cost_usd, 0),
  };
}
export type Wakes = ReturnType<typeof wakeCosts>;

export interface Row {
  turns: number;
  missed: number;
  needless: number;
  questions: number;
  tokens: number;
  /** turns × mean single-event wake (heartbeat: × mean ~10-event wake). */
  agent$: number;
  /** Useful turns × acting wake + needless turns × idle wake. */
  split$: number;
  jev$: number;
}

export const APPROACHES = ["every event", "keyword alert", "heartbeat 30 min", "jevable, rules before", "jevable"] as const;
export type Approach = (typeof APPROACHES)[number];

/** Every way of watching one case's stream, the stream taken as one day. */
export function approaches(events: Replayed[], w: Wakes): Record<Approach, Row> {
  const split = (turns: number, needless: number) => (turns - needless) * w.act + needless * w.idle;
  const woken = (by: (e: Replayed) => boolean) => {
    const hit = events.filter(by);
    const needless = hit.filter((e) => !e.matters).length;
    return { turns: hit.length, missed: events.filter((e) => e.matters && !by(e)).length, needless, agent$: hit.length * w.single.cost, split$: split(hit.length, needless) };
  };
  // Heartbeat: the events arrive evenly over one day, in stream order; each
  // check reads what arrived in the 30 minutes before it.
  const useful = new Set(events.flatMap((e, i) => (e.matters ? [Math.floor(((i + 0.5) * HEARTBEATS) / events.length)] : [])));
  const sum = (f: (e: Replayed) => number) => events.reduce((s, e) => s + f(e), 0);
  const tokens = sum((e) => e.tokens);
  const tokensBefore = sum((e) => e.tokensBefore ?? 0);
  return {
    "every event": { ...woken(() => true), questions: 0, tokens: 0, jev$: 0 },
    "keyword alert": { ...woken((e) => e.grep), questions: 0, tokens: 0, jev$: 0 },
    "heartbeat 30 min": { turns: HEARTBEATS, missed: 0, needless: HEARTBEATS - useful.size, questions: 0, tokens: 0, agent$: HEARTBEATS * w.batch.cost, split$: split(HEARTBEATS, HEARTBEATS - useful.size), jev$: 0 },
    "jevable, rules before": { ...woken((e) => e.passBefore ?? false), questions: sum((e) => e.questionsBefore ?? 0), tokens: tokensBefore, jev$: tokensBefore * JEV_PER_TOKEN },
    jevable: { ...woken((e) => e.pass), questions: sum((e) => e.questions), tokens, jev$: tokens * JEV_PER_TOKEN },
  };
}

function add(a: Row, b: Row): Row {
  return { turns: a.turns + b.turns, missed: a.missed + b.missed, needless: a.needless + b.needless, questions: a.questions + b.questions, tokens: a.tokens + b.tokens, agent$: a.agent$ + b.agent$, split$: a.split$ + b.split$, jev$: a.jev$ + b.jev$ };
}

/** A slice of the results: per case and summed over cases. */
export function tally(results: Results, pick: (e: Replayed) => boolean, w: Wakes) {
  const perCase = results.cases
    .map((c) => ({ id: c.id, events: c.events.filter(pick) }))
    .filter((c) => c.events.length)
    .map((c) => ({ ...c, rows: approaches(c.events, w) }));
  const total = Object.fromEntries(APPROACHES.map((a) => [a, perCase.map((c) => c.rows[a]).reduce(add)])) as Record<Approach, Row>;
  return {
    perCase,
    total,
    events: perCase.reduce((s, c) => s + c.events.length, 0),
    matter: perCase.reduce((s, c) => s + c.events.filter((e) => e.matters).length, 0),
    /** Whether the rules before the revision were replayed too. */
    hasBefore: perCase.some((c) => c.events.some((e) => e.passBefore !== undefined)),
  };
}
