import { parseArgs } from "node:util";
import { log, newEngine, printStats, QUESTION_OPTIONS, ruleOrQuestion } from "../common.ts";
import { expandSamples, runSamples } from "./samples.ts";

export const TEST_HELP = `jevable test QUESTION --yes SAMPLE... --no SAMPLE... [options]
jevable test --rule RULE | -f FILE --yes SAMPLE... --no SAMPLE... [options]

Run a question (as \`jevable QUESTION\` would) or a rule on samples that should
pass (--yes) and should not (--no), and show each judge answer, which samples
came out wrong, and for each question the thresholds that separate the two
sides.

A sample is literal text, or a file with one sample per line. Write the
samples and their expected side before the first run, and keep them.

Options:
      --yes SAMPLE      a sample that should pass (repeatable)
      --no SAMPLE       a sample that should not pass (repeatable)
      --on, -t, -v      as for a question (jevable --help)
      --rule RULE       a CEL rule instead of a question (-f FILE: read it from a file)
      --model MODEL     the decision model for this run only (default: the one \`jevable model\` names)

Exit status: 0 when every sample came out as expected, 1 otherwise, 2 on error.

  jevable test "Does this review comment ask for a change to the code?" --yes "can you rename this?" --no "LGTM"
  jevable test --on .body "Does this ask for a change?" --yes should.jsonl --no should-not.jsonl
  jevable test -f rule.cel --yes should.txt --no should-not.txt
`;

export async function testCommand(args: string[]): Promise<number> {
  try {
    const { values: v, positionals } = parseArgs({
      args,
      allowPositionals: true,
      options: {
        ...QUESTION_OPTIONS,
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
    const rule = ruleOrQuestion(positionals, v);
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
