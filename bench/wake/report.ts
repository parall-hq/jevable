// Turns results.json (replay.ts) and agent-runs/ (agent.ts) into the tables
// in README.md: agent turns, missed events, needless wakes and dollars for
// every way of watching, per case and in total, for all samples and for the
// held-out ones only.
//
//   node --conditions=jevable-source bench/wake/report.ts > /tmp/tables.md
//   node --conditions=jevable-source bench/wake/report.ts fresh-results.json   (fresh events, rules before and after)

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HERE } from "./cases.ts";
import { APPROACHES, JEV_PER_TOKEN, tally, wakeCosts, type AgentRun, type Replayed, type Results } from "./tally.ts";

const results = JSON.parse(readFileSync(join(HERE, process.argv[2] ?? "results.json"), "utf8")) as Results;

// ---------------------------------------------------------------- agent wakes

const runs = readdirSync(join(HERE, "agent-runs"))
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => ({ file: f, ...(JSON.parse(readFileSync(join(HERE, "agent-runs", f), "utf8")) as AgentRun & { notifyLog?: string }) }));
const w = wakeCosts(runs);
const { single, batch, act, idle, models, spent } = w;

const usd = (x: number) => (x < 0.01 ? `$${x.toFixed(4)}` : `$${x.toFixed(2)}`);

console.log(`## Agent wakes measured (${models.join(", ")})\n`);
console.log("| run | events (matter) | cost | duration | input tokens (cache read / cache write / new) | output | wrote notify.log |");
console.log("| --- | --- | --- | --- | --- | --- | --- |");
for (const r of runs) {
  const u = r.claude.usage;
  const lines = r.notifyLog ? r.notifyLog.trim().split("\n").length : 0;
  console.log(
    `| ${r.file.replace(".json", "")} | ${r.matters.length} (${r.matters.filter(Boolean).length}) | ${usd(r.claude.total_cost_usd)} | ${(r.claude.duration_ms / 1000).toFixed(1)} s | ${u.cache_read_input_tokens} / ${u.cache_creation_input_tokens} / ${u.input_tokens} | ${u.output_tokens} | ${lines ? `${lines} line${lines > 1 ? "s" : ""}` : "no"} |`,
  );
}
console.log(`\nSingle-event wake: mean ${usd(single.cost)} (n=${single.n}, ${usd(single.min)}–${usd(single.max)}), ${(single.ms / 1000).toFixed(1)} s.`);
console.log(`  of which acting on an event that matters: ${usd(act)}; deciding to do nothing: ${usd(idle)}.`);
console.log(`Heartbeat wake reading ~10 events: mean ${usd(batch.cost)} (n=${batch.n}, ${usd(batch.min)}–${usd(batch.max)}), ${(batch.ms / 1000).toFixed(1)} s.`);
console.log(`Spent on agent runs: ${usd(spent)}.\n`);

// ---------------------------------------------------------------- approaches

const SLICES = [
  ["Fresh events, labelled blind (fetched after the rules were revised; never used to write any rule)", (e: Replayed) => e.slice === "fresh"],
  ["Held-out samples only (the rules were never tuned on these; tibo has none)", (e: Replayed) => e.slice === "holdout"],
  ["All samples (tuned + held-out)", (e: Replayed) => e.slice !== "fresh"],
] as const;
for (const [title, pick] of SLICES) {
  if (!results.cases.some((c) => c.events.some(pick))) continue;
  const { perCase, total, events, matter, hasBefore } = tally(results, pick, w);
  const shown = APPROACHES.filter((a) => hasBefore || a !== "jevable, rules before");

  console.log(`## ${title}\n`);
  console.log(`${perCase.length} cases, ${events} events, ${matter} that matter. Each case is one day's stream.\n`);
  console.log("| way of watching | agent turns | missed (of " + matter + ") | needless wakes | Jev questions | Jev tokens | Jev $ | agent $ (mean wake) | total $ | total $ (acting / idle wake) |");
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const a of shown) {
    const t = total[a];
    console.log(`| ${a} | ${t.turns} | ${t.missed} | ${t.needless} | ${t.questions || "–"} | ${t.tokens || "–"} | ${t.jev$ ? usd(t.jev$) : "–"} | ${usd(t.agent$)} | ${usd(t.agent$ + t.jev$)} | ${usd(t.split$ + t.jev$)} |`);
  }
  console.log("\nPer case: agent turns / missed / needless wakes.\n");
  console.log(`| case | events (matter) | ${shown.join(" | ")} | Jev questions / tokens |`);
  console.log(`| --- | --- | ${shown.map(() => "---").join(" | ")} | --- |`);
  for (const c of perCase) {
    const cell = (a: (typeof shown)[number]) => `${c.rows[a].turns} / ${c.rows[a].missed} / ${c.rows[a].needless}`;
    console.log(`| ${c.id} | ${c.events.length} (${c.events.filter((e) => e.matters).length}) | ${shown.map(cell).join(" | ")} | ${c.rows.jevable.questions} / ${c.rows.jevable.tokens} |`);
  }
  console.log("");
}

const allTokens = results.cases.reduce((s, c) => s + c.events.reduce((t, e) => t + e.tokens, 0), 0);
console.log(`Jev for the whole replay (${results.jev}): ${allTokens} tokens, ${usd(allTokens * JEV_PER_TOKEN)}.`);
