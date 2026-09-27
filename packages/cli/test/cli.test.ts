// The command as a process: what a watcher (Claude Code's Monitor, a
// background shell) actually sees on stdout, and when the process ends.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
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
  assert.match(run.stderr, /2 records · 1 passed · 2 Jev calls/);
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

test("the key can come from ~/.jevable/key", async () => {
  const f = await fake(outage);
  const home = tempHome();
  mkdirSync(join(home, ".jevable"));
  writeFileSync(join(home, ".jevable", "key"), `${FAKE_KEY}\n`);
  const run = await jevable(["filter", `judge.boolean(line, "Is this an outage?") >= 0.7`], { input: "outage\n", env: { HOME: home, JEV_BASE_URL: f.url } });
  assert.deepEqual([run.code, run.stdout], [0, "outage\n"]);
});

test("guide, help and version", async () => {
  assert.match((await jevable(["guide"])).stdout, /# jevable — make your monitor smart/);
  assert.match((await jevable(["filter", "--help"])).stdout, /--cooldown DUR/);
  assert.match((await jevable(["--version"])).stdout, /^\d+\.\d+\.\d+\n$/);
  assert.equal((await jevable([])).code, 2);
});
