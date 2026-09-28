// Measures what one agent wake costs: Claude Code headless (`claude -p`, the
// default model) in an empty temp directory, given a short watcher brief and
// either one event (what a keyword alert or jevable wakes it with) or the ten
// events since the last check (a heartbeat). Each run's JSON output, plus
// what it wrote to notify.log, goes to bench/wake/agent-runs/.
//
//   node --conditions=jevable-source bench/wake/agent.ts
//
// Stops before total spend could pass $4.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HERE, stream, WATCHES, type Event, type Watch } from "./cases.ts";

const OUT = join(HERE, "agent-runs");
const BUDGET = 4;

/** Held-out events where the case has them (tibo has none). */
function heldOut(id: string): Event[] {
  const all = stream(id);
  const held = all.filter((e) => e.slice === "holdout");
  return held.length ? held : all;
}

const watch = (id: string) => WATCHES.find((w) => w.id === id)!;

// Four events that matter and four that do not, then three heartbeats of ten events.
const SINGLES: [string, boolean][] = [
  ["tibo", true],
  ["status", false],
  ["hn-problems", true],
  ["hn-problems", false],
  ["regressions", false],
  ["releases", true],
  ["review-asks", true],
  ["review-asks", false],
];
const BATCHES = ["status", "hn-problems", "review-asks"];

const runs: { kind: "single" | "batch"; w: Watch; events: Event[] }[] = [
  ...SINGLES.map(([id, matters]) => ({ kind: "single" as const, w: watch(id), events: [heldOut(id).find((e) => e.matters === matters)!] })),
  ...BATCHES.map((id) => ({ kind: "batch" as const, w: watch(id), events: heldOut(id).slice(0, 10) })),
];

function brief(kind: "single" | "batch", w: Watch, events: Event[]): string {
  if (kind === "single") {
    return `You are watching ${w.source} for ${w.goal}. If this event matters, append one line to notify.log saying why; otherwise do nothing.\n\nEvent:\n${events[0].line}`;
  }
  return `You are watching ${w.source} for ${w.goal}. Here are the events since your last check, one per line. For each one that matters, append one line to notify.log saying why; otherwise do nothing.\n\nEvents:\n${events.map((e) => e.line).join("\n")}`;
}

// Run as a person would from a plain shell, not as a child of this session.
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(CLAUDE|AI_AGENT|SUPERSET_AGENT)/.test(k)));

mkdirSync(OUT, { recursive: true });
let spent = 0;
let most = 0;
for (const [i, r] of runs.entries()) {
  if (spent + Math.max(most, 0.5) > BUDGET) {
    console.error(`stopping: $${spent.toFixed(3)} spent, the next run could pass $${BUDGET}`);
    break;
  }
  const dir = mkdtempSync(join(tmpdir(), "wake-"));
  const res = spawnSync("claude", ["-p", "--output-format", "json", "--permission-mode", "acceptEdits", "--no-session-persistence", "--max-budget-usd", "1"], {
    cwd: dir,
    env,
    input: brief(r.kind, r.w, r.events),
    encoding: "utf8",
    timeout: 300_000,
  });
  const out = JSON.parse(res.stdout);
  const log = join(dir, "notify.log");
  const name = `${String(i + 1).padStart(2, "0")}-${r.kind}-${r.w.id}.json`;
  writeFileSync(
    join(OUT, name),
    `${JSON.stringify({ kind: r.kind, case: r.w.id, matters: r.events.map((e) => e.matters), notifyLog: existsSync(log) ? readFileSync(log, "utf8") : null, claude: out }, null, 1)}\n`,
  );
  spent += out.total_cost_usd ?? 0;
  most = Math.max(most, out.total_cost_usd ?? 0);
  console.error(`${name}: $${out.total_cost_usd?.toFixed(4)} ${out.duration_ms} ms, notify.log ${existsSync(log) ? "written" : "none"} (matters: ${r.events.filter((e) => e.matters).length}/${r.events.length}); total $${spent.toFixed(3)}`);
}
