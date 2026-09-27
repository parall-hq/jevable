// `jevable providers`: where jevable can reach Jev, which key it found for
// each, and which one it uses — so an agent knows before asking anyone.

import { parseArgs } from "node:util";
import { Client, lookup, type Found } from "@jevable/core";
import { provider, settings } from "../common.ts";

export const PROVIDERS_HELP = `jevable providers [--check]

Where jevable can reach Jev (TypeSafe's classification model), the key it
found for each — in the environment or in ~/.jevable/env — and the one it
uses: JEV_PROVIDER if set, else the first with a key.

Options:
  --check   ask each provider with a key one question, to see that the key works
            (a fraction of a cent each)

Exit status: 0 when a provider has a key (and, with --check, answered), 1 when none does.
`;

export async function providersCommand(args: string[]): Promise<number> {
  const { values: v } = parseArgs({ args, options: { check: { type: "boolean" }, help: { type: "boolean", short: "h" } } });
  if (v.help) {
    process.stdout.write(PROVIDERS_HELP);
    return 0;
  }
  const { vars, fromFile } = settings();
  const found = lookup(vars);
  const used = provider(vars);
  const where = (f: Found) => (f.variable ? `${f.variable} (${fromFile.has(f.variable) ? "~/.jevable/env" : "environment"})` : `no ${f.provider.env[0]}`);
  const rows = await Promise.all(
    found.map(async (f) => [f.provider.name, where(f), f.provider.name === used?.provider.name ? "← used" : "", v.check && f.key ? await check(f) : ""]),
  );
  const width = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  for (const r of rows) process.stdout.write(`${r.map((c, i) => c.padEnd(width[i])).join("  ").trimEnd()}\n`);

  if (!used?.key) {
    process.stdout.write(`\nNo key for Jev. Put one of these in ~/.jevable/env (one NAME=value per line):\n`);
    const named = found.filter((f) => f.provider.keys);
    const pad = Math.max(...named.map((f) => f.provider.env[0].length)) + 4;
    for (const f of named) process.stdout.write(`  ${`${f.provider.env[0]}=...`.padEnd(pad)}  ${f.provider.label}, keys at ${f.provider.keys}\n`);
    return 1;
  }
  return v.check && !rows.find((r) => r[2])?.[3].startsWith("ok") ? 1 : 0;
}

/** One question, to see the key and the endpoint work. */
async function check(f: Found): Promise<string> {
  const p = f.provider;
  const client = new Client({ apiKey: f.key, baseUrl: p.baseUrl, model: p.model, provider: p.label });
  const start = performance.now();
  try {
    await client.ask("jevable providers --check", { q: { type: "noul", instructions: "Is this text a command?" } });
    return `ok ${((performance.now() - start) / 1000).toFixed(2)} s`;
  } catch (err) {
    return `failed: ${(err as Error).message.slice(0, 120)}`;
  }
}
