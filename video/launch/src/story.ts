// Everything the video claims or shows, derived from the repo's own files:
// the benchmark (bench/wake, through its tally.ts, as jevable.sh/bench does),
// the site's demo events and the keyword alerts. No number is written here.
// Pure: data.ts (the video) and scripts/music.ts (node) pass the files in.
import { tally, wakeCosts, type AgentRun, type Replayed, type Results } from "../../../bench/wake/tally.ts";

export interface DemoCase {
  id: string;
  rule: string;
  questions: number;
  tokens: number;
  events: { text: string; want: boolean; grep: boolean; pass: boolean; score: number | null }[];
}

export interface Inputs {
  fresh: Results;
  runs: AgentRun[];
  demo: DemoCase[];
  keywords: Record<string, string>;
}

/** One event on screen. */
export interface Ev {
  text: string;
  source: string;
  matters: boolean;
  grep: boolean;
  pass: boolean;
  /** Jev's decisive score, when it was asked. */
  score?: number;
}

const JEV_PER_TOKEN = 0.042 / 1e6; // Jev's price, as in packages/web/src/lib/cost.ts

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#x27": "'", "#x2F": "/", "#39": "'" };
const clean = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/```suggestion/g, "suggestion:")
    .replace(/#{1,6} /g, "")
    .replace(/[`*]/g, "")
    .replace(/\\(.)/g, "$1")
    .replace(/&(#x27|#x2F|#39|amp|lt|gt|quot);/g, (_, e: string) => entities[e])
    .replace(/\s+/g, " ")
    .trim();

/** The start of a text, cut at a word near `max` characters. */
export const head = (s: string, max: number) => {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6)).replace(/[\s,.;:—-]+$/, "") + "…";
};

/** A verbatim excerpt of `text` starting at `anchor` (which must be in it). */
export const excerpt = (text: string, anchor: string, max = 72) => {
  const i = text.indexOf(anchor);
  if (i < 0) throw new Error(`"${anchor}" is not in: ${text}`);
  return (i > 0 ? "…" : "") + head(text.slice(i), max);
};

/** How a fresh event reads on a card, and where it came from. */
function readable(caseId: string, line: string): { text: string; source: string } {
  const j = JSON.parse(line);
  switch (caseId) {
    case "status":
      return { text: j.name, source: j.page };
    case "hn-problems":
      return { text: clean(j.text), source: "news.ycombinator.com" };
    case "regressions":
      return { text: clean(j.title), source: `claude-code#${j.number}` };
    case "releases":
      return { text: `${j.tag} ${clean(j.body)}`, source: j.repo };
    case "review-asks":
      return { text: clean(j.body), source: "next.js review" };
    default:
      return { text: clean(line), source: caseId };
  }
}

/** The keyword alert as a grep command, and the word it looks for. */
function keyword(re: string) {
  const whole = /^\\b(.*)\\b$/.exec(re);
  const word = whole ? whole[1] : re;
  return { re: new RegExp(re, "i"), word, grep: whole ? `grep -iw '${word}'` : `grep -i '${word}'` };
}

export function story({ fresh, runs, demo, keywords }: Inputs) {
  const wakes = wakeCosts(runs);
  const f = tally(fresh, (e) => e.slice === "fresh", wakes);
  const every = f.total["every event"];
  const jev = f.total.jevable;
  const kw = f.total["keyword alert"];

  // The fresh events as one mixed feed: the cases interleaved, as the site's ticker does.
  const perCase = f.perCase.map((c) => c.events.map((e: Replayed) => ({ ...readable(c.id, e.line), matters: e.matters, grep: e.grep, pass: e.pass })));
  const longest = Math.max(...perCase.map((c) => c.length));
  const feed: Ev[] = Array.from({ length: longest }, (_, i) => perCase.map((c) => c[i]).filter(Boolean)).flat();

  const claims = {
    events: f.events,
    matter: f.matter,
    sources: f.perCase.length,
    wake: wakes.single.cost,
    wakeRuns: wakes.single.n,
    every: { wakes: every.turns, usd: every.agent$ + every.jev$ },
    jevable: { wakes: jev.turns, usd: jev.agent$ + jev.jev$, jevUsd: jev.jev$, missed: jev.missed },
    keyword: { missed: kw.missed },
    fewer: every.turns / jev.turns,
    caught: (f.matter - jev.missed) / f.matter,
    keywordCaught: (f.matter - kw.missed) / f.matter,
  };
  if (feed.length !== claims.every.wakes) throw new Error("every event should wake the agent once");

  // Scene 2: the reset alert on Tibo's posts, then the API alert on the status pages.
  const tibo = demo.find((c) => c.id === "tibo")!;
  const tiboEv = (anchor: string, max = 72): Ev & { score: number } => {
    const e = tibo.events.find((x) => x.text.includes(anchor))!;
    return { text: excerpt(e.text, anchor, max), source: "@thsottiaux on X", matters: e.want, grep: e.grep, pass: e.pass, score: e.score ?? 0 };
  };
  const status = fresh.cases.find((c) => c.id === "status")!.events.filter((e) => e.slice === "fresh");
  const statusEv = (name: string): Ev => {
    const e = status.find((x) => JSON.parse(x.line).name === name)!;
    return { ...readable("status", e.line), matters: e.matters, grep: e.grep, pass: e.pass };
  };
  const reset = keyword(keywords.tibo);
  const api = keyword(keywords.status);
  const grep = {
    reset: { ...reset, cards: [tiboEv("Reset your expectations")] },
    api: { ...api, cards: [statusEv("Elevated errors for Claude Sonnet 5"), statusEv("Degraded performance for Claude Opus 5")] },
  };
  for (const c of grep.reset.cards) if (!c.grep || c.matters || !reset.re.test(c.text)) throw new Error(`not a needless keyword wake: ${c.text}`);
  for (const c of grep.api.cards) if (c.grep || !c.matters || api.re.test(c.text)) throw new Error(`not a keyword miss: ${c.text}`);

  // Scene 4: the same posts, read by Jev with the reset rule's question.
  const question = /"([^"]+)"/.exec(tibo.rule)![1];
  const threshold = Number(/>=\s*([\d.]+)/.exec(tibo.rule)![1]);
  // the pun first, as grep saw it, then a real reset, a promise, another real reset
  const reads = ["Reset your expectations", "We did a sneaky double reset.", "I previously promised", "I have allowed Codex"].map((a) => tiboEv(a, 64));
  for (const r of reads) if (r.pass !== r.score >= threshold) throw new Error(`score and verdict disagree: ${r.text}`);

  const demoQuestions = demo.reduce((n, c) => n + c.questions, 0);
  const demoTokens = demo.reduce((n, c) => n + c.tokens, 0);
  const perQuestion = (demoTokens / demoQuestions) * JEV_PER_TOKEN;

  return { claims, feed, grep, question, threshold, reads, perQuestion };
}

export type Story = ReturnType<typeof story>;

// ---------- how numbers read on screen (as on jevable.sh) ----------
export const usd = (x: number) => `$${x.toFixed(2)}`;
export const times = (x: number) => `${x.toFixed(1)}×`;
export const pct = (x: number) => `${Math.round(x * 100)}%`;
/** "~$0.00002": one significant digit, as the README rounds it. */
export const about = (x: number) => `~$${Number(x.toPrecision(1)).toFixed(-Math.floor(Math.log10(x)))}`;
