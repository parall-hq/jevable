import { createInterface } from "node:readline";
import { Emitter, type Judged, type Output } from "./emit.ts";
import { isRuleBug, parseRecord, RuleError, toCel, type Engine, type Program } from "@jevable/core";
import { Store } from "./store.ts";
import { runWindows } from "./window.ts";

export interface FilterOptions {
  rule: string;
  key?: string;
  cooldownMs?: number;
  windowMs?: number;
  max?: number;
  json?: boolean;
  all?: boolean;
  state?: string;
  jobs?: number;
  engine: Engine;
  now?: () => number;
  signal?: AbortSignal;
}

export interface FilterResult {
  code: 0 | 1 | 2;
  noun: "records" | "windows";
  count: number;
  passed: number;
  /** -1 when not meaningful (--all). */
  emitted: number;
  error?: Error;
}

/** Everything a run needs once the rule is compiled. */
export interface Run {
  o: FilterOptions & { now: () => number; jobs: number };
  rule: Program;
  key: Program | undefined;
  store: Store;
  emitter: Emitter;
  warner: Warner;
  signal: AbortSignal;
}

/**
 * Reads records from input, one per line, and writes those that pass the
 * rule. Exit code: 0 when something was emitted, 1 when nothing was, 2 on
 * error (returned, not thrown).
 */
export async function runFilter(o: FilterOptions, input: NodeJS.ReadableStream, out: Output, log: (msg: string) => void): Promise<FilterResult> {
  const noun = o.windowMs ? "windows" : "records";
  const failed = (error: Error): FilterResult => ({ code: 2, noun, count: 0, passed: 0, emitted: 0, error });
  let rule: Program;
  let key: Program | undefined;
  let store: Store;
  try {
    rule = o.engine.compile(o.rule, "rule");
  } catch (err) {
    return failed(new Error(`rule: ${(err as Error).message}`));
  }
  try {
    key = o.key ? o.engine.compile(o.key, "key") : undefined;
  } catch (err) {
    return failed(new Error(`--key: ${(err as Error).message}`));
  }
  try {
    store = new Store(o.state);
  } catch (err) {
    return failed(new Error(`--state: ${(err as Error).message}`));
  }
  const opts = { ...o, now: o.now ?? Date.now, jobs: Math.max(1, o.jobs ?? 8) };
  const emitter = new Emitter(out, store, {
    json: !!o.json,
    all: !!o.all,
    keyed: !!o.key && !o.windowMs,
    cooldownMs: o.cooldownMs ?? 0,
    max: o.max ?? 0,
    now: opts.now,
  });
  const run: Run = { o: opts, rule, key, store, emitter, warner: new Warner(log), signal: o.signal ?? new AbortController().signal };

  let count = 0;
  let error: Error | undefined;
  try {
    count = o.windowMs ? await runWindows(run, input) : await runRecords(run, input);
  } catch (err) {
    error = err as Error;
  }
  try {
    store.save();
  } catch (err) {
    error ??= new Error(`--state: ${(err as Error).message}`);
  }
  const code = error ? 2 : emitter.emitted > 0 || (o.all && emitter.passed > 0) ? 0 : 1;
  return { code, noun, count, passed: emitter.passed, emitted: o.all ? -1 : emitter.emitted, error };
}

/**
 * Judges records concurrently (up to jobs at a time) and emits each one as
 * soon as it and everything before it are judged — a trickle of events on an
 * open stream is emitted at once, not when more arrive.
 */
async function runRecords(run: Run, input: NodeJS.ReadableStream): Promise<number> {
  const { o, emitter, signal } = run;
  const rl = createInterface({ input, crlfDelay: Infinity });
  const queue: Promise<Judged>[] = [];
  let count = 0;
  let ended = false;
  let stop = false;
  let wakeEmitter: (() => void) | undefined;
  let wakeReader: (() => void) | undefined;
  const wake = () => {
    wakeEmitter?.();
    wakeReader?.();
    wakeEmitter = wakeReader = undefined;
  };
  const halt = () => {
    stop = true;
    rl.close();
    wake();
  };
  signal.addEventListener("abort", halt, { once: true });

  const reader = (async () => {
    for await (const line of rl) {
      if (stop) break;
      if (!line.trim()) continue;
      while (queue.length >= o.jobs && !stop) await new Promise<void>((r) => (wakeReader = r));
      if (stop) break;
      queue.push(judgeRecord(run, line));
      wake();
    }
    ended = true;
    wake();
  })();

  try {
    while (!stop) {
      if (!queue.length) {
        if (ended) break;
        await new Promise<void>((r) => (wakeEmitter = r));
        continue;
      }
      const it = await queue[0];
      queue.shift();
      wake();
      count++;
      checkStop(run, it.error, `record ${count}`);
      if (emitter.record(it)) break;
    }
  } finally {
    halt();
    signal.removeEventListener("abort", halt);
    await reader.catch(() => undefined);
  }
  return count;
}

async function judgeRecord(run: Run, line: string): Promise<Judged> {
  const { json } = parseRecord(line);
  const vars = { line, json: toCel(json) };
  const it: Judged = { line, json, pass: false, calls: [] };
  try {
    if (!run.key) return { ...it, ...(await run.rule.match(vars, run.signal)) };
    it.key = await run.key.key(vars, run.signal);
    return { ...it, ...(await run.store.verdictFor(it.key, () => run.rule.match(vars, run.signal))) };
  } catch (err) {
    return { ...it, error: err as Error };
  }
}

/** Throws when the run must stop (no key, a bug in the rule); warns about anything else. */
export function checkStop(run: Run, err: Error | undefined, where: string): void {
  if (run.o.engine.fatal) throw run.o.engine.fatal;
  if (!err || run.signal.aborted) return;
  if (isRuleBug(err)) throw new RuleError(`rule: ${err.message}`);
  run.warner.warn(where, err);
}

/** Prints each distinct evaluation error once. */
export class Warner {
  private readonly seen = new Set<string>();
  private readonly log: (msg: string) => void;
  constructor(log: (msg: string) => void) {
    this.log = log;
  }
  warn(where: string, err: Error): void {
    if (this.seen.has(err.message)) return;
    this.seen.add(err.message);
    this.log(`${where}: ${err.message} (not passed; repeats of this error are not shown)`);
  }
}
