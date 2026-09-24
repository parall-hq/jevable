import { parseArgs } from "node:util";
import { log, newEngine, printStats, ruleSource } from "../common.ts";
import { runFilter } from "../run/filter.ts";

export const FILTER_HELP = `jev filter [RULE] [options]

Print the records that pass RULE. Records come from stdin, one per line; in
RULE, \`line\` is the text and \`json\` the parsed value when the line is JSON.

With --key, records with the same key are the same thing: judged once and
emitted once (or once per --cooldown). With --window, records are gathered
for that long and RULE judges each window as a whole through \`window\`.

Options:
  -f, --file FILE       read the rule from a file
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
An error that stops jev is also printed on stdout, so a watcher reading only
stdout still learns why. See \`jev guide\` for everything else.

  tail -n 0 -F app.log | jev filter --json --key 'fingerprint(line)' --cooldown 30m \\
    'line.contains("ERROR") && judge.boolean(line, "Does this log line report that a service or a dependency it needs is down or unreachable?") >= 0.7'
  some-feed | jev filter -m 1 --json -f rule.cel
`;

export async function filterCommand(args: string[]): Promise<number> {
  const asJSON = args.some((a) => ["--json", "--all", "-w", "--window"].includes(a) || a.startsWith("--window="));
  // Whatever watches jev (Claude Code's Monitor, a background shell) reads
  // stdout only, and the source feeding it (tail -F) keeps the pipeline open
  // after jev exits: on stderr alone the watcher would wait in silence.
  const stopped = (err: Error): number => {
    log(err.message);
    const msg = `jev stopped: ${err.message}`;
    process.stdout.write(asJSON ? `${JSON.stringify({ error: msg })}\n` : `${msg}\n`);
    return 2;
  };
  try {
    const { values: v, positionals } = parseArgs({
      args,
      allowPositionals: true,
      options: {
        file: { type: "string", short: "f" },
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
    const engine = newEngine(v.model);
    const ac = new AbortController();
    process.once("SIGINT", () => ac.abort());
    process.once("SIGTERM", () => ac.abort());
    if (process.stdin.isTTY) log("reading records from stdin, one per line (Ctrl-D to end)");
    const result = await runFilter(
      {
        rule: ruleSource(positionals, v.file),
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
      process.stdin,
      process.stdout,
      log,
    );
    if (result.count > 0 || !result.error) printStats(result, result.noun, engine);
    return result.error ? stopped(result.error) : result.code;
  } catch (err) {
    return stopped(err as Error);
  }
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
