// Replays each case's labelled events through a keyword alert and through
// jevable (real Jev answers from the case's rule.cel), recording per event
// what each let through and what Jev was asked. report.ts turns this into
// agent turns and dollars for every way of watching.
//
//   TYPESAFE_API_KEY=... node --conditions=jevable-source bench/wake/replay.ts
//
// (or any Jev key jevable takes, e.g. OPENROUTER_API_KEY)
//
// Writes bench/wake/results.json. With --fresh, replays the blind-labelled
// fresh events (bench/fresh/) through the current rules and the rules before
// the revision, into bench/wake/fresh-results.json.
//
// --model NAME asks another decision model (default: JEV_MODEL, else the
// provider's), and --out FILE writes there instead, current rules only and
// without each event's text (bench/fresh/ has it, in the same order): how
// bench/models/ compares models on the same events.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { choose, Client, Engine, lookup, parseRecord, toCel } from "@jevable/core";
import { fresh, HERE, rule, ruleBefore, stream, WATCHES } from "./cases.ts";

const { values: opts } = parseArgs({ options: { fresh: { type: "boolean" }, model: { type: "string" }, out: { type: "string" } } });
const FRESH = opts.fresh ?? false;
// the rules before the revision are part of the published fresh results only
const BEFORE = FRESH && !opts.out;

const keywords = JSON.parse(readFileSync(join(HERE, "keywords.json"), "utf8")) as Record<string, string>;
const found = choose(lookup(process.env));
const p = found?.provider;
const client = () => new Client({ apiKey: found?.key, baseUrl: p?.baseUrl, path: p?.path, model: opts.model || process.env.JEV_MODEL || p?.model, provider: p?.label });
const engine = new Engine(client());
// Its own engine, so that each rule version's Jev questions and tokens are counted apart.
const engineBefore = new Engine(client());

const cases = [];
for (const w of WATCHES) {
  const stream_ = FRESH ? fresh(w.id) : stream(w.id);
  if (!stream_.length) continue;
  const program = engine.compile(rule(w.id));
  const programBefore = BEFORE ? engineBefore.compile(ruleBefore(w.id)) : undefined;
  const grep = new RegExp(keywords[w.id], "i");
  const events = [];
  for (const e of stream_) {
    const before = { ...engine.stats };
    const vars = { line: e.line, json: toCel(parseRecord(e.line).json) };
    const start = performance.now();
    const outcome = await program.match(vars);
    const ms = Math.round(performance.now() - start);
    if (outcome.error) throw outcome.error;
    const earlier = { ...engineBefore.stats };
    const old = programBefore && (await programBefore.match(vars));
    if (old?.error) throw old.error;
    events.push({
      ...e,
      ...(opts.out ? { line: undefined } : {}),
      grep: grep.test(e.line),
      pass: outcome.pass,
      questions: engine.stats.calls - before.calls,
      tokens: engine.stats.tokens - before.tokens,
      ...(engine.stats.calls > before.calls && { ms }),
      calls: outcome.calls,
      ...(old && { passBefore: old.pass, questionsBefore: engineBefore.stats.calls - earlier.calls, tokensBefore: engineBefore.stats.tokens - earlier.tokens }),
    });
  }
  cases.push({ id: w.id, grep: keywords[w.id], events });
  console.error(`${w.id}: ${events.length} events, jevable passed ${events.filter((e) => e.pass).length}, keyword ${events.filter((e) => e.grep).length}, matter ${events.filter((e) => e.matters).length}`);
}

const out = opts.out ? resolve(opts.out) : join(HERE, FRESH ? "fresh-results.json" : "results.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify({ date: new Date().toISOString(), jev: `${engine.model} via ${p?.label}`, stats: engine.stats, cases }, null, 1)}\n`);
