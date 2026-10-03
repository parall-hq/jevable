// `jevable model`: which decision model jevable asks, and which others the
// key can use. Chosen once and saved next to the key; `--model` on a run
// overrides it for that run only.

import { parseArgs } from "node:util";
import { check, clientFor, modelOf, provider, say, settings, writeEnv } from "../common.ts";

export const MODEL_HELP = `jevable model [NAME]

Without NAME: the decision model jevable asks, and the others your key can use.
With NAME: check that model with one question and save the choice in
~/.jevable/env; \`jevable model default\` goes back to the default (Jev).
\`--model NAME\` on a run overrides it for that run only.

Thresholds differ between models: after switching, run \`jevable test\` again.

Exit status: 0 when the model works, 1 when not.
`;

export async function modelCommand(args: string[]): Promise<number> {
  const { values: v, positionals } = parseArgs({ args, allowPositionals: true, options: { help: { type: "boolean", short: "h" } } });
  if (v.help) return say(MODEL_HELP.trimEnd(), 0);
  const { vars } = settings();
  const found = provider(vars);
  if (!found?.key) return say("No key yet: run `jevable key` first.", 1);
  const p = found.provider;
  const name = positionals[0]?.trim();

  if (name === "default") {
    writeEnv({ JEV_MODEL: null });
    return say(`Back to ${p.model}, the default via ${p.label}.`, 0);
  }
  if (name) {
    const r = await check(clientFor(p, found.key, name));
    if ("error" in r) return say(`${name} does not work via ${p.label}: ${r.error}. Nothing saved; \`jevable model\` lists what your key can use.`, 1);
    writeEnv({ JEV_MODEL: name });
    return say(`Saved: jevable asks ${name} via ${p.label} (${r.seconds} s). Thresholds differ between models: run \`jevable test\` on your samples again.`, 0);
  }

  const current = modelOf(vars, p)!;
  const now = `${current} via ${p.label}${vars.JEV_MODEL ? "" : " (the default)"}.`;
  if (!p.catalog) return say(`${now} ${p.label} serves no other decision model.`, 0);
  let others: string[];
  try {
    others = (await clientFor(p, found.key, current).models(p.catalog)).filter((m) => m !== current);
  } catch (err) {
    return say(`${now} Could not list the others: ${(err as Error).message}`, 0);
  }
  if (!others.length) return say(`${now} ${p.label} lists no other decision model.`, 0);
  return say(`${now} Your key can also use: ${others.join(", ")}. Switch with \`jevable model <name>\`, or try one for a single run with \`--model <name>\`.`, 0);
}
