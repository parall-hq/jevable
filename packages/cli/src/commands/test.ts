import { parseArgs } from "node:util";
import { log, newEngine, printStats, ruleSource } from "../common.ts";
import { expandSamples, runSamples } from "./samples.ts";

export const TEST_HELP = `jevable test [RULE] --yes SAMPLE... --no SAMPLE... [options]

Run RULE on samples that should pass (--yes) and should not (--no) and show
each judge answer, which samples came out wrong, and for each question the
thresholds that separate the two sides.

A sample is literal text, or a file with one sample per line. Write the
samples and their expected side before the first run, and keep them.

Options:
  -f, --file FILE       read the rule from a file
      --yes SAMPLE      a sample that should pass (repeatable)
      --no SAMPLE       a sample that should not pass (repeatable)
      --model MODEL     Jev model (default $JEV_MODEL, else jev-1.13.0)

Exit status: 0 when every sample came out as expected, 1 otherwise, 2 on error.

  jevable test -f rule.cel --yes "can you rename this function?" --no "LGTM" --no "thanks!"
  jevable test -f rule.cel --yes should.txt --no should-not.txt
`;

export async function testCommand(args: string[]): Promise<number> {
  try {
    const { values: v, positionals } = parseArgs({
      args,
      allowPositionals: true,
      options: {
        file: { type: "string", short: "f" },
        yes: { type: "string", multiple: true },
        no: { type: "string", multiple: true },
        model: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
    if (v.help) {
      process.stdout.write(TEST_HELP);
      return 0;
    }
    const rule = ruleSource(positionals, v.file);
    if (!v.yes?.length || !v.no?.length) throw new Error("give samples on both sides: --yes for what should pass and --no for what should not");
    const samples = [...expandSamples(v.yes, true), ...expandSamples(v.no, false)];
    const engine = newEngine(v.model);
    const { report, ok } = await runSamples(engine, rule, samples);
    process.stdout.write(report);
    printStats({ count: samples.length, passed: samples.filter((s) => s.pass).length, emitted: -1 }, "samples", engine);
    return ok ? 0 : 1;
  } catch (err) {
    log((err as Error).message);
    return 2;
  }
}
