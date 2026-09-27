// What the commands share: the engine from the environment, the rule
// source, and the stderr log with its closing summary.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { choose, Client, Engine, lookup, type Found } from "@jevable/core";
import type { FilterResult } from "./run/filter.ts";

// guide.md and package.json sit at the package root, next to src/ and dist/.
const PACKAGE_ROOT = new URL("../", import.meta.url);

export function packageFile(name: string): string {
  return readFileSync(new URL(name, PACKAGE_ROOT), "utf8");
}

export const log = (msg: string): void => {
  process.stderr.write(`jevable: ${msg}\n`);
};

export const ENV_FILE = join(homedir(), ".jevable", "env");

/**
 * The environment, with ~/.jevable/env (NAME=value lines) filling in what it
 * lacks: for runtimes that keep secrets out of a command's environment (dsh
 * drops every variable named *KEY*) and for watches started elsewhere.
 */
export function settings(): { vars: Record<string, string | undefined>; fromFile: Set<string> } {
  const vars: Record<string, string | undefined> = { ...process.env };
  const fromFile = new Set<string>();
  let text = "";
  try {
    text = readFileSync(ENV_FILE, "utf8");
  } catch {}
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=\s*(.*?)\s*$/);
    if (!m || vars[m[1]]) continue;
    vars[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
    fromFile.add(m[1]);
  }
  return { vars, fromFile };
}

/** The provider of Jev to use, from the environment: JEV_PROVIDER, else the first with a key. */
export function provider(vars = settings().vars): Found | undefined {
  return choose(lookup(vars), vars.JEV_PROVIDER);
}

/** The shared engine, configured from the environment. A missing key is reported by the first judge call. */
export function newEngine(model?: string): Engine {
  const { vars } = settings();
  const found = provider(vars);
  const p = found?.provider;
  return new Engine(new Client({ apiKey: found?.key, baseUrl: p?.baseUrl, model: model || vars.JEV_MODEL || p?.model, provider: p?.label }));
}

/** The rule from the positional argument or -f, exactly one. */
export function ruleSource(positionals: string[], file?: string): string {
  if (file && positionals.length) throw new Error("give the rule as an argument or with -f, not both");
  if (file) return readFileSync(file, "utf8");
  if (positionals.length > 1) throw new Error(`one rule only, got ${positionals.length} arguments — quote the rule`);
  if (positionals[0]?.trim()) return positionals[0];
  throw new Error(`missing rule, e.g. jevable filter 'judge.boolean(line, "Is this an outage?") >= 0.7' — see \`jevable guide\``);
}

export function printStats(r: Pick<FilterResult, "count" | "passed" | "emitted">, noun: string, engine: Engine): void {
  const { calls, cacheHits, tokens } = engine.stats;
  const unit = r.count === 1 ? noun.replace(/s$/, "") : noun;
  const held = r.emitted >= 0 && r.emitted !== r.passed ? ` (${r.emitted} emitted, the rest held back by --key/--cooldown)` : "";
  const via = calls ? ` via ${engine.client.provider}` : "";
  log(`${r.count} ${unit} · ${r.passed} passed${held} · ${calls} Jev calls${via} (+${cacheHits} from cache) · ${tokens} tokens`);
}
