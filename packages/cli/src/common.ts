// What the commands share: the engine from the environment, the rule
// source, and the stderr log with its closing summary.

import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { choose, Client, Engine, lookup, type Found, type Provider } from "@jevable/core";
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

/** The provider to use, from the environment: JEV_PROVIDER, else the first with a key. */
export function provider(vars = settings().vars): Found | undefined {
  return choose(lookup(vars), vars.JEV_PROVIDER);
}

/**
 * The model to ask: --model for one run, else the one chosen with `jevable
 * model` (JEV_MODEL), else the provider's default, Jev.
 */
export function modelOf(vars: Record<string, string | undefined>, p?: Provider, override?: string): string | undefined {
  return override || vars.JEV_MODEL || p?.model;
}

/** A client for provider `p` with `key`, asking `model`. */
export function clientFor(p: Provider | undefined, key: string | undefined, model: string | undefined): Client {
  return new Client({ apiKey: key, baseUrl: p?.baseUrl, path: p?.path, model, provider: p?.label });
}

/** The shared engine, configured from the environment. A missing key is reported by the first judge call. */
export function newEngine(model?: string): Engine {
  const { vars } = settings();
  const found = provider(vars);
  return new Engine(clientFor(found?.provider, found?.key, modelOf(vars, found?.provider, model)));
}

/** One question, to see that a key, an endpoint and a model work together. */
export async function check(client: Client): Promise<{ seconds: string } | { error: string }> {
  const start = performance.now();
  try {
    await client.ask("jevable key", { q: { type: "noul", instructions: "Is this text a command?" } });
    return { seconds: ((performance.now() - start) / 1000).toFixed(2) };
  } catch (err) {
    return { error: (err as Error).message.replace(/\.$/, "") };
  }
}

/** Sets NAME=value lines in ~/.jevable/env (null removes one), keeping the rest; readable by the owner only. */
export function writeEnv(set: Record<string, string | null>): void {
  let lines: string[] = [];
  try {
    lines = readFileSync(ENV_FILE, "utf8").split("\n").filter(Boolean);
  } catch {}
  lines = lines.filter((l) => !Object.keys(set).includes(l.match(/^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=/)?.[1] ?? ""));
  for (const [name, value] of Object.entries(set)) if (value !== null) lines.push(`${name}=${value}`);
  mkdirSync(dirname(ENV_FILE), { recursive: true, mode: 0o700 });
  writeFileSync(ENV_FILE, `${lines.join("\n")}\n`, { mode: 0o600 });
  chmodSync(ENV_FILE, 0o600);
}

/** Prints an answer for the person or agent, and returns the exit status. */
export function say(text: string, code: number): number {
  process.stdout.write(`${text}\n`);
  return code;
}

/** A jq-style path (.body, .user.login, .items[0], .["a-b"]) as CEL over the record's JSON. */
export function jqPath(path: string): string {
  if (!path.startsWith(".")) throw new Error(`--on ${JSON.stringify(path)}: give a jq-style path such as .body or .user.login`);
  return path === "." ? "json" : `json${path.replace(/\.\[/g, "[")}`;
}

export interface QuestionOptions {
  /** CEL, in place of a question. */
  rule?: string;
  file?: string;
  /** jq-style paths of the fields Jev reads; the whole line when none. */
  on?: string[];
  threshold?: string;
  invert?: boolean;
}

/**
 * The rule to run: --rule or -f (CEL), else the rule a plain question stands
 * for — judge.boolean on the line or the --on fields, against the threshold.
 */
export function ruleOrQuestion(positionals: string[], o: QuestionOptions): string {
  if (o.rule !== undefined || o.file) {
    if (positionals.length) throw new Error("give a question, or a rule with --rule or -f, not both");
    if (o.on?.length || o.threshold !== undefined) throw new Error("--on and -t go with a question; in a rule, write them into judge.boolean(...)");
    return invert(ruleSource(o.rule !== undefined ? [o.rule] : [], o.file), o.invert);
  }
  if (positionals.length > 1) throw new Error(`one question only, got ${positionals.length} arguments — quote the question`);
  const question = positionals[0]?.trim();
  if (!question) throw new Error("missing question, e.g. jevable \"Does this line report an outage?\" — see `jevable guide`");
  const on = o.on ?? [];
  const material = on.length === 0 ? "line" : on.length === 1 ? jqPath(on[0]) : `[${on.map(jqPath).join(", ")}]`;
  const t = o.threshold === undefined ? 0.7 : Number(o.threshold);
  if (!(t > 0 && t < 1)) throw new Error(`-t ${JSON.stringify(o.threshold)}: give a number between 0 and 1, e.g. 0.7`);
  return `judge.boolean(${material}, ${JSON.stringify(question)}) ${o.invert ? "<" : ">="} ${t}`;
}

/** -v on a rule: the records it does not pass. */
export const invert = (rule: string, on?: boolean) => (on ? `!(${rule.trim()})` : rule);

/** The options a question takes, for parseArgs. */
export const QUESTION_OPTIONS = {
  rule: { type: "string" },
  file: { type: "string", short: "f" },
  on: { type: "string", multiple: true },
  threshold: { type: "string", short: "t" },
  invert: { type: "boolean", short: "v" },
} as const;

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
  const to = calls ? ` to ${engine.model} via ${engine.client.provider}` : "";
  log(`${r.count} ${unit} · ${r.passed} passed${held} · ${calls} call${calls === 1 ? "" : "s"}${to} (+${cacheHits} from cache) · ${tokens} tokens`);
}
