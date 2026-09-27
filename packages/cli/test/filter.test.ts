import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Readable } from "node:stream";
import { after, test } from "node:test";
import { Client, Engine, NO_KEY } from "@jevable/core";
import { fakeJev, outage, type Answerer, type FakeJev } from "@jevable/core/testing";
import { expandSamples, runSamples } from "../src/commands/samples.ts";
import { runFilter, type FilterOptions } from "../src/run/filter.ts";

// A fake Jev for this file, closed when the file's tests end.
async function fake(answer: Answerer) {
  const f = await fakeJev(answer);
  after(() => f.close());
  return f;
}

const OUTAGE = `judge.boolean(line, "Is this an outage?") >= 0.7`;
const BODY_OUTAGE = `judge.boolean(json.body, "Is this an outage?") >= 0.7`;

async function filter(f: FakeJev | Engine, o: Omit<FilterOptions, "engine">, input: string | NodeJS.ReadableStream) {
  let out = "";
  const logs: string[] = [];
  const engine = f instanceof Engine ? f : f.engine();
  const stream = typeof input === "string" ? Readable.from([input]) : input;
  const res = await runFilter({ engine, jobs: 4, ...o }, stream, { write: (s: string) => (out += s) }, (m) => logs.push(m));
  return { out, lines: out.split("\n").filter(Boolean), res, logs };
}

test("passes matching lines, in input order", async () => {
  const f = await fake(outage);
  const input = Array.from({ length: 40 }, (_, i) => (i % 3 === 0 ? `outage ${i}` : `fine ${i}`)).join("\n");
  const { lines, res } = await filter(f, { rule: OUTAGE }, input);
  assert.deepEqual(lines, Array.from({ length: 14 }, (_, i) => `outage ${3 * i}`));
  assert.equal(res.code, 0);
});

test("--json carries the answers", async () => {
  const f = await fake(outage);
  const { lines } = await filter(f, { rule: BODY_OUTAGE, json: true }, `{"id": 1, "body": "outage in eu"}\n`);
  assert.deepEqual(JSON.parse(lines[0]), {
    json: { id: 1, body: "outage in eu" },
    judge: [{ fn: "boolean", question: "Is this an outage?", value: 0.9 }],
  });
});

test("a single event on an open stream is emitted at once", async () => {
  const f = await fake(outage);
  const input = new PassThrough();
  let out = "";
  const running = runFilter({ engine: f.engine(), rule: OUTAGE, jobs: 8 }, input, { write: (s: string) => (out += s) }, () => {});
  input.write("outage 1\n");
  for (let i = 0; i < 100 && !out; i++) await new Promise((r) => setTimeout(r, 10));
  assert.equal(out, "outage 1\n");
  input.end();
  assert.equal((await running).code, 0);
});

test("nothing passed is exit code 1", async () => {
  const f = await fake(outage);
  assert.equal((await filter(f, { rule: OUTAGE }, "all good\n")).res.code, 1);
});

test("-m stops after that many", async () => {
  const f = await fake(outage);
  const { out, res } = await filter(f, { rule: OUTAGE, max: 1, jobs: 1 }, "outage 1\noutage 2\noutage 3\n");
  assert.deepEqual([out, res.code], ["outage 1\n", 0]);
});

test("--key judges and emits each key once", async () => {
  const f = await fake(outage);
  const input = [
    `{"id": 1, "body": "outage"}`,
    `{"id": 2, "body": "fine"}`,
    `{"id": 1, "body": "outage"}`,
    `{"id": 3, "body": "outage again"}`,
    `{"id": 2, "body": "fine"}`,
  ].join("\n");
  const { lines } = await filter(f, { rule: BODY_OUTAGE, key: "json.id" }, input);
  assert.deepEqual(lines, [`{"id": 1, "body": "outage"}`, `{"id": 3, "body": "outage again"}`]);
  assert.equal(f.calls(), 3);
});

test("fingerprint key and cooldown tame a flood", async () => {
  const f = await fake(outage);
  const input = Array.from({ length: 500 }, () => "ERROR outage on shard 17 after 3012ms req_8f2a\nINFO served req_77c1 in 12ms").join("\n");
  let clock = Date.UTC(2026, 8, 23);
  const { lines } = await filter(
    f,
    { rule: `line.contains("ERROR") && ${OUTAGE}`, json: true, key: "fingerprint(line)", cooldownMs: 30 * 60_000, now: () => (clock += 60_000) },
    input,
  );
  // One pass per minute of fake time; a 30-minute cooldown → an emit every 30 passes.
  assert.equal(lines.length, 17);
  assert.equal(JSON.parse(lines[1]).suppressed, 29);
  assert.equal(f.calls(), 1);
});

test("--state remembers keys across runs", async () => {
  const f = await fake(outage);
  const state = join(mkdtempSync(join(tmpdir(), "jev-")), "state.json");
  const input = `{"id": 1, "body": "outage"}\n`;
  assert.equal((await filter(f, { rule: BODY_OUTAGE, key: "json.id", state }, input)).res.code, 0);
  assert.equal((await filter(f, { rule: BODY_OUTAGE, key: "json.id", state }, input)).res.code, 1);
  assert.equal(f.calls(), 1);
});

test("--window judges the whole", async () => {
  const f = await fake(outage);
  const input = "ERROR outage on shard 3 after 12ms\n".repeat(30) + "INFO ok 200 in 5ms\n".repeat(70);
  const rule = `window.total == 100 && window.kinds == 2 && window.groups.exists(g, g.new && g.count == 30) && judge.boolean(window.summary, "Is there an outage?") >= 0.7`;
  const { lines } = await filter(f, { rule, windowMs: 3_600_000, key: "fingerprint(line)" }, input);
  const got = JSON.parse(lines[0]);
  assert.equal(got.window.total, 100);
  assert.equal(got.window.summary, undefined);
  assert.equal(got.judge.length, 1);
});

test("--window with --state knows kinds seen before", async () => {
  const f = await fake(outage);
  const state = join(mkdtempSync(join(tmpdir(), "jev-")), "kinds.json");
  const o = { rule: `window.groups.exists(g, g.new && g.sample.contains("ERROR"))`, windowMs: 3_600_000, key: "fingerprint(line)", state };
  assert.equal((await filter(f, o, "ERROR disk 1 full\n")).res.code, 0);
  assert.equal((await filter(f, o, "ERROR disk 7 full\n")).res.code, 1);
});

test("an empty window fires on silence", async () => {
  const f = await fake(outage);
  const input = new PassThrough();
  const { lines, res } = await filter(f, { rule: `window.total == 0 && window.prev_total == 0`, windowMs: 30, max: 1 }, input);
  assert.equal(JSON.parse(lines[0]).window.total, 0);
  assert.equal(res.code, 0);
});

test("a missing key stops the run", async () => {
  const { res } = await filter(new Engine(new Client()), { rule: OUTAGE }, "outage\n");
  assert.deepEqual([res.code, res.error?.message], [2, NO_KEY]);
});

test("rules without judge need no key", async () => {
  const { out } = await filter(new Engine(new Client()), { rule: `line.contains("x")` }, "x\ny\n");
  assert.equal(out, "x\n");
});

test("a missing field warns once and does not pass", async () => {
  const f = await fake(outage);
  const { out, logs } = await filter(f, { rule: BODY_OUTAGE }, `plain text\nmore text\n{"body": "outage"}\n`);
  assert.equal(out, `{"body": "outage"}\n`);
  assert.equal(logs.filter((l) => l.startsWith("record")).length, 1);
});

test("jevable test reports wrong samples and the thresholds that separate", async () => {
  const f = await fake((state) => {
    if (state.includes("rename")) return { noul: 0.91 };
    if (state.includes("nit")) return { noul: 0.62 };
    if (state.includes("later")) return { noul: 0.55 };
    return { noul: 0.08 };
  });
  const samples = [...expandSamples(["can you rename this?", "nit: maybe split this"], true), ...expandSamples(["LGTM", "thanks, will look later"], false)];
  const { report, ok } = await runSamples(f.engine(), `judge.boolean(line, "Does this ask for a code change?") >= 0.7`, samples);
  assert.equal(ok, false);
  for (const want of [/WRONG\s+yes\s+0\.62/, /3 of 4 as expected\./, /any threshold above 0\.55 and up to 0\.62/]) assert.match(report, want);
});

test("jevable test finds the threshold when passing means a low score", async () => {
  const f = await fake((state) => ({ probabilities: state.includes("breaking") ? { breaking: 0.95, other: 0.05 } : { breaking: 0.1, other: 0.9 } }));
  const samples = [...expandSamples(["breaking: renamed the API"], true), ...expandSamples(["fixed a typo"], false)];
  const { report, ok } = await runSamples(f.engine(), `judge.choice(line, "Kind?", {"breaking": "", "other": ""})["other"] <= 0.3`, samples);
  assert.equal(ok, true);
  assert.match(report, /\["other"\] yes 0\.05–0\.05 · no 0\.90–0\.90 → any threshold from 0\.05 up to below 0\.90 separates them \(use <=\)/);
});

test("jevable test shows only the choice options the rule reads", async () => {
  const f = await fake((state) => ({ probabilities: state.includes("reset") ? { now: 0.9, soon: 0.05, other: 0.05 } : { now: 0.02, soon: 0.08, other: 0.9 } }));
  const samples = [...expandSamples(["limits reset for all"], true), ...expandSamples(["new model today"], false)];
  const { report } = await runSamples(f.engine(), `judge.choice(line, "Reset?", {"now": "", "soon": "", "other": ""})["now"] >= 0.7`, samples);
  assert.match(report, /\["now"\] yes 0\.90/);
  assert.doesNotMatch(report, /\["soon"\]|\["other"\]/);
});
