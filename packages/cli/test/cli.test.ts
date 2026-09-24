// The command as a process: what a watcher (Claude Code's Monitor, a
// background shell) actually sees on stdout, and when the process ends.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
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

function jev(args: string[], opts: { input?: string; keepOpen?: boolean; env?: Record<string, string> } = {}) {
  const child = spawn(process.execPath, ["--conditions=jevable-source", CLI, ...args], {
    env: { PATH: process.env.PATH ?? "", ...opts.env },
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
  const noKey = await jev(["filter", "--json", `judge.boolean(line, "Is this an outage?") >= 0.7`], { input: "outage\n" });
  assert.equal(noKey.code, 2);
  assert.match(JSON.parse(noKey.stdout).error, /jev stopped: no Jev API key/);

  const badRule = await jev(["filter", `lin.contains("x")`], { input: "x\n" });
  assert.equal(badRule.code, 2);
  assert.match(badRule.stdout, /jev stopped: rule: unknown variable 'lin'/);

  const badFlag = await jev(["filter", "--cooldwn", "5m", "true"], { input: "x\n" });
  assert.equal(badFlag.code, 2);
  assert.match(badFlag.stdout, /jev stopped: .*--cooldwn/);
});

test("-m 1 ends the process while stdin stays open", async () => {
  const f = await fake(outage);
  const run = await jev(["filter", "-m", "1", "--json", `judge.boolean(line, "Is this an outage?") >= 0.7`], {
    input: "fine\noutage now\n",
    keepOpen: true,
    env: { JEV_API_KEY: FAKE_KEY, JEV_BASE_URL: f.url },
  });
  assert.equal(run.code, 0);
  assert.equal(JSON.parse(run.stdout).line, "outage now");
  assert.match(run.stderr, /2 records · 1 passed · 2 Jev calls/);
});

test("guide, help and version", async () => {
  assert.match((await jev(["guide"])).stdout, /# jev — grep that reads meaning/);
  assert.match((await jev(["filter", "--help"])).stdout, /--cooldown DUR/);
  assert.match((await jev(["--version"])).stdout, /^\d+\.\d+\.\d+\n$/);
  assert.equal((await jev([])).code, 2);
});
