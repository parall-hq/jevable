#!/usr/bin/env node
// The jevable command line: filter, test, guide.

import { filterCommand } from "./commands/filter.ts";
import { keyCommand } from "./commands/key.ts";
import { testCommand } from "./commands/test.ts";
import { log, packageFile } from "./common.ts";

const HELP = `jevable — make your monitor smart: grep that reads meaning

Pipe lines in; jevable prints the ones for which Jev, a fast and cheap
classification model, answers yes to your question. Put it in front of
whatever wakes an agent, or wherever you would otherwise read many things to
find the few that matter.

  tail -n 0 -F app.log | jevable "Does this line report that a dependency is down?"
  gh issue list --json title,body | jq -c '.[]' | jevable --on .body "Is this a bug report about login?"

Usage:
  jevable QUESTION [options]          filter by a yes/no question (--on .field, -t 0.7, -v)
  jevable filter RULE [options]       filter by a CEL rule: plain conditions and judge.* questions
  jevable test QUESTION --yes .. --no ..   check a question (or --rule) on samples, find the threshold
  jevable key [KEY]                   whether there is a working key for Jev; with KEY, check and save it
  jevable guide                       when and how to use it, and recipes

Agents: read \`jevable guide\` first and follow it.
Setup: \`jevable key\`. Any API key from TypeSafe, OpenRouter or Vercel AI Gateway works.
Run \`jevable filter --help\` for every option.
`;

// Like grep in `jevable ... | head`: when the reader goes away, stop quietly.
process.stdout.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code !== "EPIPE") throw err;
  process.exit(0);
});

async function main([cmd, ...args]: string[]): Promise<number> {
  switch (cmd) {
    case "filter":
      return filterCommand(args, "rule");
    case "test":
      return testCommand(args);
    case "key":
      return keyCommand(args);
    case "guide":
      process.stdout.write(packageFile("guide.md"));
      return 0;
    case "--version":
      process.stdout.write(`${JSON.parse(packageFile("package.json")).version}\n`);
      return 0;
    case "-h":
    case "--help":
    case "help":
      process.stdout.write(HELP);
      return 0;
    case undefined:
      process.stderr.write(HELP);
      return 2;
    default:
      // Like grep: anything else is the question, with its options.
      return filterCommand([cmd, ...args], "question");
  }
}

main(process.argv.slice(2)).then(
  (code) => {
    // stdin may hold the process open (tail -F feeding us): stop reading,
    // and leave once stdout is flushed.
    process.stdin.destroy();
    process.stdout.write("", () => process.exit(code));
  },
  (err) => {
    log(String(err?.stack ?? err));
    process.exit(2);
  },
);
