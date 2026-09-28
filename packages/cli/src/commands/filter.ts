import { spawn } from "node:child_process";
import { parseArgs } from "node:util";
import { invert, log, newEngine, printStats, QUESTION_OPTIONS, ruleOrQuestion, ruleSource } from "../common.ts";
import { runFilter } from "../run/filter.ts";

export const FILTER_HELP = `jevable QUESTION [options]
jevable filter RULE [options]

Print the records for which Jev answers yes to QUESTION, or that pass RULE: a
CEL expression of plain conditions and judge.* questions. Records come from
stdin, or from the output of --from CMD, one per line; in RULE, \`line\` is the
text and \`json\` the parsed value when the line is JSON.

With a question:
      --on PATH         judge this field of JSON records, jq style (.body, .user.login); repeat for several
  -t, --threshold N     pass when the probability of yes is at least N (default 0.7)
  -v, --invert          pass when it is below instead (with a rule: when the rule is false)
      --rule RULE       a CEL rule instead of a question (-f FILE: read it from a file)

With --key, records with the same key are the same thing: judged once and
emitted once (or once per --cooldown). With --window, records are gathered
for that long and a rule judges each window as a whole through \`window\`.

Options:
      --from CMD        read the output of CMD (run with sh) instead of stdin; CMD stops when jevable does
  -k, --key EXPR        what makes records the same thing, e.g. json.id or fingerprint(line)
      --cooldown DUR    after emitting a key, hold back its further matches this long (e.g. 30m)
  -w, --window DUR      judge windows of this length instead of single records (always JSON)
  -m, --max-count N     stop after emitting N
      --json            emit JSON lines with the judge answers
      --all             emit everything with "pass" and the answers, to see the scores first
      --state FILE      remember keys across runs
  -j, --jobs N          records judged at the same time (default 8)
      --model MODEL     Jev model (default $JEV_MODEL, else jev-1.13.0)

Exit status: 0 when something was emitted, 1 when nothing was, 2 on error.
An error that stops jevable is also printed on stdout, so a watcher reading only
stdout still learns why. See \`jevable guide\` for everything else.

  tail -n 0 -F app.log | jevable "Does this line report that a dependency is down?"
  gh api repos/o/r/issues --jq '.[] | @json' | jevable --on .title --on .body "Is this a bug report about login?"
  git log --oneline -200 | jevable "Does this commit change a public API?"
  jevable filter --key 'fingerprint(line)' --cooldown 30m --from 'tail -n 0 -F app.log' \\
    'line.contains("ERROR") && judge.boolean(line, "Does this report that a dependency is down?") >= 0.7'
`;

/** `form`: what the positional argument is — a question (`jevable QUESTION`) or a CEL rule (`jevable filter RULE`). */
export async function filterCommand(args: string[], form: "question" | "rule"): Promise<number> {
  const asJSON = args.some((a) => ["--json", "--all", "-w", "--window"].includes(a) || a.startsWith("--window="));
  // Whatever watches jevable (Claude Code's Monitor, a background shell) reads
  // stdout only, and the source feeding it (tail -F) keeps the pipeline open
  // after jevable exits: on stderr alone the watcher would wait in silence.
  const stopped = (err: Error): number => {
    log(err.message);
    const msg = `jevable stopped: ${err.message}`;
    process.stdout.write(asJSON ? `${JSON.stringify({ error: msg })}\n` : `${msg}\n`);
    return 2;
  };
  try {
    const { values: v, positionals } = parseArgs({
      args,
      allowPositionals: true,
      options: {
        ...QUESTION_OPTIONS,
        from: { type: "string" },
        key: { type: "string", short: "k" },
        cooldown: { type: "string" },
        window: { type: "string", short: "w" },
        "max-count": { type: "string", short: "m" },
        json: { type: "boolean" },
        all: { type: "boolean" },
        state: { type: "string" },
        jobs: { type: "string", short: "j" },
        model: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
    if (v.help) {
      process.stdout.write(FILTER_HELP);
      return 0;
    }
    if (form === "rule" && (v.on?.length || v.threshold !== undefined))
      throw new Error(`--on and -t go with a question: jevable --on .body "Does this ask for a change?"`);
    const rule = form === "question" ? ruleOrQuestion(positionals, v) : invert(v.rule ?? ruleSource(positionals, v.file), v.invert);
    const engine = newEngine(v.model);
    const ac = new AbortController();
    process.once("SIGINT", () => ac.abort());
    process.once("SIGTERM", () => ac.abort());
    const source = v.from ? startSource(v.from) : undefined;
    if (!source && process.stdin.isTTY) log("reading records from stdin, one per line (Ctrl-D to end)");
    const result = await runFilter(
      {
        rule,
        key: v.key,
        cooldownMs: v.cooldown ? parseDuration(v.cooldown, "--cooldown") : 0,
        windowMs: v.window ? parseDuration(v.window, "--window") : 0,
        max: v["max-count"] ? parseCount(v["max-count"], "--max-count") : 0,
        json: v.json,
        all: v.all,
        state: v.state,
        jobs: v.jobs ? parseCount(v.jobs, "--jobs") : 8,
        engine,
        signal: ac.signal,
      },
      source?.output ?? process.stdin,
      process.stdout,
      log,
    );
    const sourceError = await source?.stop();
    if (result.count > 0 || !result.error) printStats(result, result.noun, engine);
    const error = result.error ?? sourceError;
    return error ? stopped(error) : result.code;
  } catch (err) {
    return stopped(err as Error);
  }
}

/**
 * --from: jevable runs the source itself, so that it stops with jevable. In a pipe
 * (`tail -F log | jevable -m 1`) the command would only end at tail's next write.
 */
function startSource(cmd: string) {
  // Its own process group: stopping it also stops what it started (tail, a loop's sleep).
  const child = spawn("sh", ["-c", cmd], { stdio: ["ignore", "pipe", "inherit"], detached: true });
  const closed = new Promise<number | null>((resolve) => child.on("close", resolve));
  // However jevable ends (a reader that went away included), the source ends with it.
  process.once("exit", () => {
    try {
      process.kill(-child.pid!, "SIGTERM");
    } catch {}
  });
  return {
    output: child.stdout,
    /** Stop the source if it still runs; the error when it ended on its own with a failure. */
    async stop(): Promise<Error | undefined> {
      if (!child.stdout.readableEnded) {
        try {
          process.kill(-child.pid!, "SIGTERM");
        } catch {}
        return undefined;
      }
      const code = await closed;
      return code ? new Error(`--from command exited with status ${code}`) : undefined;
    },
  };
}

const UNITS: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** Durations like 90s, 30m, 1h30m, 2d. */
function parseDuration(s: string, flag: string): number {
  if (!/^(\d+(\.\d+)?(ms|s|m|h|d))+$/.test(s)) throw new Error(`${flag}: ${JSON.stringify(s)} is not a duration like 90s, 30m, 1h30m`);
  let ms = 0;
  for (const [, n, , unit] of s.matchAll(/(\d+(\.\d+)?)(ms|s|m|h|d)/g)) ms += Number(n) * UNITS[unit];
  return ms;
}

function parseCount(s: string, flag: string): number {
  const n = Number(s);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${flag}: ${JSON.stringify(s)} is not a positive whole number`);
  return n;
}
