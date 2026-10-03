// The command as a process: what a watcher (Claude Code's Monitor, a
// background shell) actually sees on stdout, and when the process ends.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { FAKE_KEY, fakeJev, outage, type Answerer } from "@jevable/core/testing";

// A fake Jev for this file, closed when the file's tests end.
async function fake(answer: Answerer) {
  const f = await fakeJev(answer);
  after(() => f.close());
  return f;
}

const CLI = fileURLToPath(new URL("../src/cli.ts", import.meta.url));

// A home of its own, so that a real ~/.jevable/key never leaks into a test.
const tempHome = () => mkdtempSync(join(tmpdir(), "jev-home-"));
const HOME = tempHome();

function jevable(args: string[], opts: { input?: string; keepOpen?: boolean; env?: Record<string, string> } = {}) {
  const child = spawn(process.execPath, ["--conditions=jevable-source", CLI, ...args], {
    env: { PATH: process.env.PATH ?? "", HOME, ...opts.env },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (c) => (stdout += c));
  child.stderr.on("data", (c) => (stderr += c));
  if (opts.input !== undefined) child.stdin.write(opts.input);
  if (!opts.keepOpen) child.stdin.end();
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("a stopping error is on stdout too", async () => {
  const noKey = await jevable(["filter", "--json", `judge.boolean(line, "Is this an outage?") >= 0.7`], { input: "outage\n" });
  assert.equal(noKey.code, 2);
  assert.match(JSON.parse(noKey.stdout).error, /jevable stopped: no Jev API key/);

  const badRule = await jevable(["filter", `lin.contains("x")`], { input: "x\n" });
  assert.equal(badRule.code, 2);
  assert.match(badRule.stdout, /jevable stopped: rule: unknown variable 'lin'/);

  const badFlag = await jevable(["filter", "--cooldwn", "5m", "true"], { input: "x\n" });
  assert.equal(badFlag.code, 2);
  assert.match(badFlag.stdout, /jevable stopped: .*--cooldwn/);
});

test("-m 1 ends the process while stdin stays open", async () => {
  const f = await fake(outage);
  const run = await jevable(["filter", "-m", "1", "--json", `judge.boolean(line, "Is this an outage?") >= 0.7`], {
    input: "fine\noutage now\n",
    keepOpen: true,
    env: { JEV_API_KEY: FAKE_KEY, JEV_BASE_URL: f.url },
  });
  assert.equal(run.code, 0);
  assert.equal(JSON.parse(run.stdout).line, "outage now");
  assert.match(run.stderr, /2 records · 1 passed · 2 calls to jev-1\.13\.0 via /);
});

test("--from stops the source when jevable stops", async () => {
  const run = await jevable(["filter", "-m", "1", "--from", "while true; do echo tick; sleep 0.05; done", `line == "tick"`]);
  assert.deepEqual([run.code, run.stdout], [0, "tick\n"]);
});

test("a failing --from source stops jevable with the reason on stdout", async () => {
  const run = await jevable(["filter", "--from", "echo fine; exit 3", `line == "never"`]);
  assert.equal(run.code, 2);
  assert.match(run.stdout, /jevable stopped: --from command exited with status 3/);
});

test("settings can come from ~/.jevable/env", async () => {
  const f = await fake(outage);
  const home = tempHome();
  mkdirSync(join(home, ".jevable"));
  writeFileSync(join(home, ".jevable", "env"), `# for jevable\nexport JEV_API_KEY="${FAKE_KEY}"\nJEV_BASE_URL=${f.url}\n`);
  const run = await jevable(["filter", `judge.boolean(line, "Is this an outage?") >= 0.7`], { input: "outage\n", env: { HOME: home } });
  assert.deepEqual([run.code, run.stdout], [0, "outage\n"]);
  assert.ok(run.stderr.includes(`1 call to jev-1.13.0 via ${f.url}`), run.stderr);
});

test("key without one says what to ask the person", async () => {
  const run = await jevable(["key"]);
  assert.equal(run.code, 1);
  assert.match(run.stdout, /^No key for Jev\. Ask the person for an API key from TypeSafe, OpenRouter or Vercel AI Gateway, then run: jevable key <the key>/);
});

test("key checks a pasted key and saves it where later runs find it", async () => {
  const f = await fake(outage);
  const home = tempHome();
  const env = { HOME: home, JEV_BASE_URL: f.url };
  const wrong = await jevable(["key", "wrong"], { env });
  assert.equal(wrong.code, 1);
  assert.match(wrong.stdout, /does not work: .*401: invalid api key\. Nothing saved\./);
  assert.equal(existsSync(join(home, ".jevable", "env")), false);

  const saved = await jevable(["key", FAKE_KEY], { env });
  assert.equal(saved.code, 0);
  assert.match(saved.stdout, /^Saved the .* key in ~\/\.jevable\/env; it works/);
  assert.equal(statSync(join(home, ".jevable", "env")).mode & 0o777, 0o600);
  assert.match((await jevable(["key"], { env })).stdout, /key in ~\/\.jevable\/env; it works/);
  const run = await jevable(["filter", `judge.boolean(line, "Is this an outage?") >= 0.7`], { input: "outage\n", env });
  assert.deepEqual([run.code, run.stdout], [0, "outage\n"]);
});

test("key refuses what is no key jevable can use", async () => {
  const run = await jevable(["key", "sk-ant-api03-xyz"]);
  assert.equal(run.code, 1);
  assert.match(run.stdout, /not a key jevable can use: TypeSafe keys start with apikey_/);
});

test("model lists what the key can use, switches after one check, and goes back to the default", async () => {
  const f = await fake(outage);
  const home = tempHome();
  const env = { HOME: home, JEV_BASE_URL: f.url };
  assert.match((await jevable(["model"], { env })).stdout, /^No key yet: run `jevable key` first\./);
  await jevable(["key", FAKE_KEY], { env });
  const saved = () => readFileSync(join(home, ".jevable", "env"), "utf8");

  const list = await jevable(["model"], { env });
  assert.equal(list.code, 0);
  assert.match(list.stdout, /^jev-1\.13\.0 via .* \(the default\)\. Your key can also use: fake-d1\. Switch with `jevable model <name>`/);

  const bad = await jevable(["model", "no-such-model"], { env });
  assert.equal(bad.code, 1);
  assert.match(bad.stdout, /^no-such-model does not work via .*404.*Nothing saved/);
  assert.doesNotMatch(saved(), /JEV_MODEL/);

  const ok = await jevable(["model", "fake-d1"], { env });
  assert.equal(ok.code, 0);
  assert.match(ok.stdout, /^Saved: jevable asks fake-d1 via .* run `jevable test` on your samples again\./);
  assert.match(saved(), /^JEV_MODEL=fake-d1$/m);
  assert.match((await jevable(["key"], { env })).stdout, /^fake-d1 via .*; it works/);
  // the saved choice is what runs ask, and --model overrides it for one run
  const run = await jevable(["Is this an outage?"], { input: "outage\n", env });
  assert.deepEqual([run.code, run.stdout], [0, "outage\n"]);
  const once = await jevable(["--model", "no-such-model", "Is this an outage?"], { input: "outage\n", env });
  assert.notEqual(once.code, 0);
  assert.match(once.stdout + once.stderr, /404/);

  assert.match((await jevable(["model", "default"], { env })).stdout, /^Back to jev-1\.13\.0/);
  assert.doesNotMatch(saved(), /JEV_MODEL/);
});

test("a question filters like grep, on a field with --on, inverted with -v", async () => {
  const f = await fake(outage);
  const env = { JEV_API_KEY: FAKE_KEY, JEV_BASE_URL: f.url };
  const lines = "db outage in eu\nall fine\nanother outage\n";
  assert.deepEqual((await jevable(["Is this an outage?"], { input: lines, env })).stdout, "db outage in eu\nanother outage\n");
  assert.deepEqual((await jevable(["-v", "Is this an outage?"], { input: lines, env })).stdout, "all fine\n");
  const records = `{"title": "outage", "body": "all fine"}\n{"title": "hello", "body": "outage in eu"}\n`;
  assert.equal((await jevable(["--on", ".body", "Is this an outage?"], { input: records, env })).stdout, `{"title": "hello", "body": "outage in eu"}\n`);
  const test = await jevable(["test", "Is this an outage?", "--yes", "outage now", "--no", "lunch"], { env });
  assert.equal(test.code, 0);
  assert.match(test.stdout, /2 of 2 as expected/);
});

test("a reader that goes away (| head) ends jevable quietly, and its source with it", async () => {
  const child = spawn(process.execPath, ["--conditions=jevable-source", CLI, "--from", "while true; do echo x; done", "--rule", 'line == "x"'], {
    env: { PATH: process.env.PATH ?? "", HOME },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (c) => (stderr += c));
  child.stdout.once("data", () => child.stdout.destroy());
  const code = await new Promise((resolve) => child.on("close", resolve));
  assert.equal(code, 0);
  assert.doesNotMatch(stderr, /EPIPE/);
});

test("guide, help and version", async () => {
  assert.match((await jevable(["guide"])).stdout, /# jevable — make your monitor smart/);
  assert.match((await jevable(["filter", "--help"])).stdout, /--cooldown DUR/);
  assert.match((await jevable(["--version"])).stdout, /^\d+\.\d+\.\d+\n$/);
  assert.equal((await jevable([])).code, 2);
});
