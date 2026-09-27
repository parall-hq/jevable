// `jevable key`: is there a key for Jev, and does it work? Given a key: whose
// it is, checked with one question and saved where every runtime and detached
// watch finds it. The person pastes a key; they never pick a provider or a
// variable name.

import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { Client, lookup, whose, type Provider } from "@jevable/core";
import { ENV_FILE, provider, settings } from "../common.ts";

export const KEY_HELP = `jevable key [KEY]

Without KEY: whether jevable has a key for Jev, and whether it works.
With KEY: tell whose key it is (TypeSafe, OpenRouter or Vercel AI Gateway),
check it with one question, and save it in ~/.jevable/env, where every
runtime and detached watch finds it.

Exit status: 0 when a working key is in place, 1 when not.
`;

const ASK = "Ask the person for an API key from TypeSafe, OpenRouter or Vercel AI Gateway, then run: jevable key <the key>";

export async function keyCommand(args: string[]): Promise<number> {
  const { values: v, positionals } = parseArgs({ args, allowPositionals: true, options: { help: { type: "boolean", short: "h" } } });
  if (v.help) return say(KEY_HELP.trimEnd(), 0);
  const { vars, fromFile } = settings();
  if (positionals[0]) return save(positionals[0].trim(), vars);

  const found = provider(vars);
  if (!found?.key) return say(`No key for Jev. ${ASK}`, 1);
  const where = fromFile.has(found.variable!) ? "in ~/.jevable/env" : `from ${found.variable}`;
  const r = await check(found.provider, found.key);
  if ("error" in r) return say(`The ${found.provider.label} key ${where} does not work: ${r.error}. ${ASK}`, 1);
  return say(`Jev via ${found.provider.label}, key ${where}; it works (${r.seconds} s).`, 0);
}

async function save(key: string, vars: Record<string, string | undefined>): Promise<number> {
  // A custom endpoint (JEV_BASE_URL) takes any key; otherwise the key says whose it is.
  const p = vars.JEV_BASE_URL ? lookup(vars)[0].provider : whose(key);
  if (!p) return say("That is not a key for Jev: TypeSafe keys start with apikey_, OpenRouter keys with sk-or-, Vercel AI Gateway keys with vck_.", 1);
  const r = await check(p, key);
  if ("error" in r) return say(`The ${p.label} key does not work: ${r.error}. Nothing saved.`, 1);
  // Name the provider too, so a key saved now wins over an older one elsewhere.
  writeEnv(p.name === "custom" ? { [p.env[0]]: key } : { [p.env[0]]: key, JEV_PROVIDER: p.name });
  return say(`Saved the ${p.label} key in ~/.jevable/env; it works (${r.seconds} s).`, 0);
}

/** One question, to see the key and the endpoint work. */
async function check(p: Provider, key: string): Promise<{ seconds: string } | { error: string }> {
  const client = new Client({ apiKey: key, baseUrl: p.baseUrl, model: p.model, provider: p.label });
  const start = performance.now();
  try {
    await client.ask("jevable key", { q: { type: "noul", instructions: "Is this text a command?" } });
    return { seconds: ((performance.now() - start) / 1000).toFixed(2) };
  } catch (err) {
    return { error: (err as Error).message.replace(/\.$/, "") };
  }
}

/** Sets NAME=value lines in ~/.jevable/env, keeping the rest; readable by the owner only. */
function writeEnv(set: Record<string, string>): void {
  let lines: string[] = [];
  try {
    lines = readFileSync(ENV_FILE, "utf8").split("\n").filter(Boolean);
  } catch {}
  lines = lines.filter((l) => !Object.keys(set).includes(l.match(/^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=/)?.[1] ?? ""));
  for (const [name, value] of Object.entries(set)) lines.push(`${name}=${value}`);
  mkdirSync(dirname(ENV_FILE), { recursive: true, mode: 0o700 });
  writeFileSync(ENV_FILE, `${lines.join("\n")}\n`, { mode: 0o600 });
  chmodSync(ENV_FILE, 0o600);
}

function say(text: string, code: number): number {
  process.stdout.write(`${text}\n`);
  return code;
}
