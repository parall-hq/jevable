// Compares decision models on the same 334 blind-labelled fresh events and the
// same rules (thresholds tuned on Jev): what each catches, how often it wakes
// the agent for nothing, and what that costs. A model answers a little
// differently from run to run, so each is replayed a few times, one file per
// run in a folder per model:
//
//   JEV_PROVIDER=... node --conditions=jevable-source bench/wake/replay.ts --fresh --model NAME --out bench/models/<model>/<run>.json
//
// Then: node --conditions=jevable-source bench/models/compare.ts

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { HERE } from "../wake/cases.ts";
import { tally, wakeCosts, type AgentRun, type Results } from "../wake/tally.ts";

const MODELS = new URL(".", import.meta.url).pathname;

/** USD per million input tokens, as each provider lists it; output is free everywhere here. */
const PRICE: Record<string, number> = {
  "jev-1.13.0": 0.042,
  "jev-preview": 0.042, // an alias of jev-1.13.0 for now (docs.typesafe.ai/models)
  "@cf/cloudflare/clef-flash": 0.09,
  "@cf/cloudflare/clef": 0.24,
  "liquid/d1": 0.04,
  "upstage/solar-decide": 0.05,
  "inception/mercury-decide:free": 0,
  "jaredpalmer/kev-4b": 0.042,
};

const runs = readdirSync(join(HERE, "agent-runs"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(HERE, "agent-runs", f), "utf8")) as AgentRun);
const w = wakeCosts(runs);

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const usd = (x: number) => (Number.isNaN(x) ? "–" : x < 0.01 ? `$${x.toFixed(4)}` : `$${x.toFixed(2)}`);
/** The mean of the runs, and their range when they differ. */
const spread = (xs: number[], digits = 1) => {
  const lo = Math.min(...xs),
    hi = Math.max(...xs);
  return lo === hi ? `${lo}` : `${mean(xs).toFixed(digits)} (${lo}–${hi})`;
};

/** One replay of one model. */
function run(file: string) {
  const r = JSON.parse(readFileSync(file, "utf8")) as Results;
  const [model, via] = r.jev.split(" via ");
  const t = tally(r, () => true, w);
  const j = t.total.jevable;
  const price = PRICE[model];
  const model$ = price === undefined ? NaN : (j.tokens * price) / 1e6;
  const events = r.cases.flatMap((c) => c.events);
  return {
    model,
    via,
    matter: t.matter,
    caught: t.matter - j.missed,
    needless: j.needless,
    turns: j.turns,
    questions: j.questions,
    tokens: j.tokens,
    model$,
    total$: j.agent$ + model$,
    // events that asked one question: the round trip from where this ran, network included
    ms: events.filter((e) => e.questions === 1 && e.ms !== undefined).map((e) => e.ms!),
  };
}

const rows = readdirSync(MODELS)
  .filter((d) => statSync(join(MODELS, d)).isDirectory())
  .map((d) => {
    const rs = readdirSync(join(MODELS, d))
      .filter((f) => f.endsWith(".json"))
      .map((f) => run(join(MODELS, d, f)));
    return { ...rs[0], runs: rs };
  })
  .sort((a, b) => mean(b.runs.map((r) => r.caught)) - mean(a.runs.map((r) => r.caught)) || mean(a.runs.map((r) => r.total$)) - mean(b.runs.map((r) => r.total$)));

console.log("| model | via | runs | caught (of 52) | needless wakes | agent turns | questions | model $ | total $ (agent + model) | median per question |");
console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const r of rows) {
  const of = <K extends "caught" | "needless" | "turns" | "questions" | "model$" | "total$">(k: K) => r.runs.map((x) => x[k]);
  console.log(
    `| ${r.model} | ${r.via} | ${r.runs.length} | ${spread(of("caught"))} | ${spread(of("needless"))} | ${spread(of("turns"))} | ${spread(of("questions"))} | ${usd(mean(of("model$")))} | ${usd(mean(of("total$")))} | ${Math.round(median(r.runs.flatMap((x) => x.ms)))} ms |`,
  );
}
