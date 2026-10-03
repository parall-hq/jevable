// `jevable key`: is there a key, and does it work? Given a key: whose it is,
// checked with one question and saved where every runtime and detached watch
// finds it. The person pastes a key; they never pick a provider or a
// variable name. Which model it asks is `jevable model`.

import { parseArgs } from "node:util";
import { lookup, whose } from "@jevable/core";
import { check, clientFor, modelOf, provider, say, settings, writeEnv } from "../common.ts";

export const KEY_HELP = `jevable key [KEY]

Without KEY: whether jevable has a key, which model it asks, and whether they
work. With KEY: tell whose key it is (TypeSafe, OpenRouter, Vercel AI Gateway
or Perplexity), check it with one question, and save it in ~/.jevable/env,
where every runtime and detached watch finds it. \`jevable model\` lists the
other decision models the key can use.

Exit status: 0 when a working key is in place, 1 when not.
`;

const ASK = "Ask the person for an API key from TypeSafe, OpenRouter or Vercel AI Gateway, then run: jevable key <the key>";
const MODELS = "`jevable model` lists the other decision models it can use.";

export async function keyCommand(args: string[]): Promise<number> {
  const { values: v, positionals } = parseArgs({ args, allowPositionals: true, options: { help: { type: "boolean", short: "h" } } });
  if (v.help) return say(KEY_HELP.trimEnd(), 0);
  const { vars, fromFile } = settings();
  if (positionals[0]) return save(positionals[0].trim(), vars);

  const found = provider(vars);
  if (!found?.key) return say(`No key for Jev. ${ASK}`, 1);
  const p = found.provider;
  const model = modelOf(vars, p)!;
  const where = fromFile.has(found.variable!) ? "in ~/.jevable/env" : `from ${found.variable}`;
  const r = await check(clientFor(p, found.key, model));
  if ("error" in r) {
    const next = vars.JEV_MODEL ? `Run \`jevable model default\` to go back to ${p.model}, or \`jevable model\` to pick another.` : ASK;
    return say(`The ${p.label} key ${where} does not work with ${model}: ${r.error}. ${next}`, 1);
  }
  const keep = fromFile.has(found.variable!)
    ? ""
    : ` It is only in this shell's environment: run \`jevable key "$${found.variable}"\` to save it for watches started elsewhere.`;
  return say(`${model} via ${p.label}, key ${where}; it works (${r.seconds} s).${keep}`, 0);
}

async function save(key: string, vars: Record<string, string | undefined>): Promise<number> {
  // A custom endpoint (JEV_BASE_URL) takes any key; otherwise the key says whose it is.
  const p = vars.JEV_BASE_URL ? lookup(vars)[0].provider : whose(key);
  if (!p) return say("That is not a key jevable can use: TypeSafe keys start with apikey_, OpenRouter keys with sk-or-, Vercel AI Gateway keys with vck_, Perplexity keys with pplx-.", 1);
  const r = await check(clientFor(p, key, p.model));
  if ("error" in r) return say(`The ${p.label} key does not work: ${r.error}. Nothing saved.`, 1);
  // Name the provider too, so a key saved now wins over an older one elsewhere;
  // a model chosen for another provider goes, since model names differ between them.
  writeEnv({
    [p.env[0]]: key,
    ...(p.name === "custom" ? {} : { JEV_PROVIDER: p.name }),
    ...(vars.JEV_PROVIDER === p.name ? {} : { JEV_MODEL: null }),
  });
  return say(`Saved the ${p.label} key in ~/.jevable/env; it works (${r.seconds} s). It asks ${p.model} by default; ${MODELS}`, 0);
}
