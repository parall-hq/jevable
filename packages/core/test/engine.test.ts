import assert from "node:assert/strict";
import { after, test } from "node:test";
import { Client, Engine, fingerprint, NO_KEY, parseRecord, RuleError, toCel } from "../src/index.ts";
import { fakeJev, outage, type Answerer } from "../src/testing.ts";

// A fake Jev for this file, closed when the file's tests end.
async function fake(answer: Answerer) {
  const f = await fakeJev(answer);
  after(() => f.close());
  return f;
}

const vars = (line: string) => {
  const r = parseRecord(line);
  return { line: r.line, json: toCel(r.json) };
};

test("judge functions", async () => {
  const f = await fake(outage);
  const eng = f.engine();
  const cases: [string, string, boolean][] = [
    [`judge.boolean(line, "Is this an outage?") >= 0.7`, "checkout outage since 14:02", true],
    [`judge.boolean(line, "Is this an outage?") >= 0.7`, "rename the tab", false],
    [`judge.boolean(line, "Is this an outage?", {"true": "customers blocked", "false": "anything else"}) >= 0.7`, "big outage", true],
    [`judge.choice(json.body, "Which team?", {"infra": "outages", "other": null})["infra"] >= 0.7`, `{"body": "outage in eu"}`, true],
    [`judge.choice(json.body, "Which team?", {"infra": "outages", "other": null}).other >= 0.7`, `{"body": "typo in faq"}`, true],
    [`judge.score([json.title, json.body], "How bad?", ["fine", "degraded", "down"]) >= 1.5`, `{"title": "down", "body": "outage"}`, true],
    [`json.user != "bot" && judge.boolean(json.body, "Is this an outage?") >= 0.7`, `{"user": "bot", "body": "outage"}`, false],
    [`json.id == 42 && json.tags.exists(t, t == "p0")`, `{"id": 42, "tags": ["p0"]}`, true],
    [`fingerprint(line) == "timeout after <n>ms"`, "timeout after 3012ms", true],
  ];
  for (const [expr, line, want] of cases) {
    const out = await eng.compile(expr).match(vars(line));
    assert.equal(out.error, undefined, `${expr} on ${line}: ${out.error?.message}`);
    assert.equal(out.pass, want, `${expr} on ${line}`);
  }
});

test("a plain condition that decides the rule means no Jev call", async () => {
  const f = await fake(outage);
  const out = await f.engine().compile(`line.contains("ERROR") && judge.boolean(line, "Is this an outage?") >= 0.7`).match(vars("INFO all good"));
  assert.deepEqual([out.pass, out.calls.length, f.calls()], [false, 0, 0]);
});

test("two questions in one rule are both asked and recorded", async () => {
  const f = await fake(outage);
  const out = await f.engine().compile(`judge.boolean(line, "A?") >= 0.7 && judge.boolean(line, "B?") >= 0.7`).match(vars("outage"));
  assert.deepEqual([out.pass, out.calls.map((c) => c.question), f.calls()], [true, ["A?", "B?"], 2]);
});

test("the same question on the same material is asked once, also when asked together", async () => {
  const f = await fake(outage);
  const eng = f.engine();
  const prg = eng.compile(`judge.boolean(line, "Is this an outage?") >= 0.7`);
  const outs = await Promise.all(Array.from({ length: 5 }, () => prg.match(vars("ERROR outage"))));
  assert.ok(outs.every((o) => o.pass && o.calls.length === 1));
  assert.equal(f.calls(), 1);
  assert.deepEqual([eng.stats.calls, eng.stats.cacheHits], [1, 4]);
});

test("a refused key is fatal", async () => {
  const f = await fake(outage);
  const eng = new Engine(new Client({ apiKey: "wrong", baseUrl: f.url }));
  const out = await eng.compile(`judge.boolean(line, "Is this an outage?") >= 0.7`).match(vars("outage"));
  assert.ok(out.error);
  assert.match(eng.fatal?.message ?? "", /refused/);
});

test("no key is fatal, rules without judge need none", async () => {
  const eng = new Engine(new Client({ apiKey: "" }));
  const out = await eng.compile(`judge.boolean(line, "q?") >= 0.7`).match(vars("x"));
  assert.equal(out.error?.message, NO_KEY);
  assert.equal((await new Engine(new Client()).compile(`line.contains("x")`).match(vars("x"))).pass, true);
});

test("rules that cannot work are refused before any record", () => {
  const eng = new Engine(new Client());
  for (const [expr, why] of [
    [`judge.boolean(line, "q")`, /compare it/],
    [`judge.boolean(json.body, "q")`, /compare it/],
    [`judge.boolean(line) >= 0.7`, /no matching overload/],
    [`judge.bolean(line, "q") >= 0.7`, /unbound function/],
    [`lin.contains("x")`, /unknown variable 'lin'/],
    [`[1, 2].exists(g, g == x)`, /unknown variable 'x'/],
    [`line.contains("x"`, /Variables: line/],
    [`size(line)`, /true or false/],
  ] as const) {
    assert.throws(() => eng.compile(expr), (e: Error) => e instanceof RuleError && why.test(e.message), expr);
  }
  eng.compile(`[1, 2].exists(g, g == 2) && type(line) == string`);
});

test("key", async () => {
  const eng = new Engine(new Client());
  assert.equal(await eng.compile("json.id", "key").key(vars(`{"id": 42}`)), "42");
  assert.equal(await eng.compile("json.user", "key").key(vars(`{"user": "alice"}`)), "alice");
});

test("fingerprint", () => {
  const a = fingerprint(`ERROR db timeout after 3012ms on req_8f2a user="alice" at 2026-09-23T10:00:00Z`);
  const b = fingerprint(`ERROR db timeout after 95ms on req_77c1 user="bob" at 2026-09-23T11:23:45Z`);
  assert.equal(a, b);
  assert.equal(a, `ERROR db timeout after <n>ms on <id> user="<s>" at <id>`);
  assert.notEqual(fingerprint("disk full"), fingerprint("disk slow"));
});
