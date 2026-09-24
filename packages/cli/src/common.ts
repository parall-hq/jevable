// What the commands share: the engine from the environment, the rule
// source, and the stderr log with its closing summary.

import { readFileSync } from "node:fs";
import { Client, Engine } from "@jevable/core";
import type { FilterResult } from "./run/filter.ts";

// guide.md and package.json sit at the package root, next to src/ and dist/.
const PACKAGE_ROOT = new URL("../", import.meta.url);

export function packageFile(name: string): string {
  return readFileSync(new URL(name, PACKAGE_ROOT), "utf8");
}

export const log = (msg: string): void => {
  process.stderr.write(`jev: ${msg}\n`);
};

/** The shared engine, configured from the environment. A missing key is reported by the first judge call. */
export function newEngine(model?: string): Engine {
  const env = process.env;
  return new Engine(new Client({ apiKey: env.JEV_API_KEY || env.TYPESAFE_API_KEY, baseUrl: env.JEV_BASE_URL, model: model || env.JEV_MODEL }));
}

/** The rule from the positional argument or -f, exactly one. */
export function ruleSource(positionals: string[], file?: string): string {
  if (file && positionals.length) throw new Error("give the rule as an argument or with -f, not both");
  if (file) return readFileSync(file, "utf8");
  if (positionals.length > 1) throw new Error(`one rule only, got ${positionals.length} arguments — quote the rule`);
  if (positionals[0]?.trim()) return positionals[0];
  throw new Error(`missing rule, e.g. jev filter 'judge.boolean(line, "Is this an outage?") >= 0.7' — see \`jev guide\``);
}

export function printStats(r: Pick<FilterResult, "count" | "passed" | "emitted">, noun: string, engine: Engine): void {
  const { calls, cacheHits, tokens } = engine.stats;
  const unit = r.count === 1 ? noun.replace(/s$/, "") : noun;
  const held = r.emitted >= 0 && r.emitted !== r.passed ? ` (${r.emitted} emitted, the rest held back by --key/--cooldown)` : "";
  log(`${r.count} ${unit} · ${r.passed} passed${held} · ${calls} Jev calls (+${cacheHits} from cache) · ${tokens} tokens`);
}
