#!/usr/bin/env node
// The jevable command line: filter, test, guide.

import { filterCommand } from "./commands/filter.ts";
import { providersCommand } from "./commands/providers.ts";
import { testCommand } from "./commands/test.ts";
import { log, packageFile } from "./common.ts";

const HELP = `jevable — make your monitor smart

jevable reads records from stdin (or from --from CMD), one per line, and prints
the ones that pass a rule: a CEL expression over the record that may ask Jev,
a fast and cheap classification model, a semantic question.

  jevable filter --from 'tail -n 0 -F app.log' 'line.contains("ERROR") &&
      judge.boolean(line, "Does this log line report that a service or a dependency it needs is down or unreachable?") >= 0.7'

Commands:
  filter [RULE]                  print the records (or windows) that pass RULE
  test [RULE] --yes .. --no ..   run RULE on samples and show the scores
  providers [--check]            where jevable reaches Jev, the key it found, the one it uses
  guide                          what to do and how: steps for agents, rules, options, recipes

Agents: read \`jevable guide\` first and follow it.
Setup: a key for Jev from TypeSafe (TYPESAFE_API_KEY), Vercel AI Gateway
       (AI_GATEWAY_API_KEY) or OpenRouter (OPENROUTER_API_KEY), in the environment
       or in ~/.jevable/env. \`jevable providers\` shows what it finds.
       JEV_PROVIDER picks one; JEV_BASE_URL + JEV_API_KEY for a proxy; JEV_MODEL.
Run \`jevable <command> --help\` for a command's options.
`;

async function main([cmd, ...args]: string[]): Promise<number> {
  switch (cmd) {
    case "filter":
      return filterCommand(args);
    case "test":
      return testCommand(args);
    case "providers":
      return providersCommand(args);
    case "guide":
      process.stdout.write(packageFile("guide.md"));
      return 0;
    case "-v":
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
      log(`unknown command ${JSON.stringify(cmd)} — see \`jevable --help\``);
      return 2;
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
