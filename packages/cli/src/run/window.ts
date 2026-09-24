import { createInterface } from "node:readline";
import { checkStop, type Run } from "./filter.ts";
import { clip, parseRecord, toCel, type CelInput } from "@jevable/core";
import type { Store } from "./store.ts";

/**
 * Gathers records for o.windowMs at a time and judges each window as a
 * whole. Records are grouped by --key (default: the line itself); the last,
 * partial window is judged at end of input if it holds any record. All work
 * runs on one chain, so records and flushes keep their order.
 */
export function runWindows(run: Run, input: NodeJS.ReadableStream): Promise<number> {
  const { o, rule, key, store, emitter, signal } = run;
  let win = new Window(o.now());
  let prevTotal = 0;
  let count = 0;
  let chain: Promise<void> = Promise.resolve();
  let finished = false;

  return new Promise((resolve, reject) => {
    const rl = createInterface({ input, crlfDelay: Infinity });
    const finish = (err?: unknown) => {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      rl.close();
      signal.removeEventListener("abort", onAbort);
      if (err) reject(err);
      else resolve(count);
    };
    const onAbort = () => finish();
    const enqueue = (step: () => Promise<void> | void) => {
      chain = chain.then(() => (finished ? undefined : step())).catch(finish);
    };

    const flush = async () => {
      const closing = win;
      win = new Window(o.now());
      count++;
      const value = closing.value(o.now(), prevTotal, store);
      const out = await rule.match({ window: value.cel }, signal);
      checkStop(run, out.error, `window ${count}`);
      for (const k of closing.groups.keys()) store.update(k, (ks) => (ks.seen = true));
      prevTotal = closing.total;
      if (emitter.window(value.plain, out.pass, out.calls, out.error)) finish();
    };

    signal.addEventListener("abort", onAbort, { once: true });
    const timer = setInterval(() => enqueue(flush), o.windowMs);
    rl.on("line", (line) => {
      if (!line.trim()) return;
      if (!key) return enqueue(() => win.add(line, line));
      enqueue(async () => {
        let k = line;
        try {
          k = await key.key({ line, json: toCel(parseRecord(line).json) }, signal);
        } catch (err) {
          run.warner.warn("--key", err as Error);
        }
        win.add(k, line);
      });
    });
    rl.on("close", () =>
      enqueue(async () => {
        if (win.total > 0) await flush();
        finish();
      }),
    );
  });
}

interface Group {
  key: string;
  sample: string;
  count: number;
}

// window.summary, the text meant as judge material, is bounded.
const SUMMARY_CHARS = 8000;

class Window {
  readonly start: number;
  readonly groups = new Map<string, Group>();
  total = 0;

  constructor(start: number) {
    this.start = start;
  }

  add(key: string, line: string): void {
    this.total++;
    const g = this.groups.get(key);
    if (g) g.count++;
    else this.groups.set(key, { key, sample: line, count: 1 });
  }

  /**
   * The `window` variable (cel: integers as CEL ints) and its printable form
   * (plain): counts, the groups — keys never seen in an earlier window first,
   * then the most frequent — and a summary of them for judge.* to read.
   */
  value(end: number, prevTotal: number, store: Store): { plain: Record<string, unknown>; cel: CelInput } {
    const rows = [...this.groups.values()]
      .map((g) => ({ ...g, isNew: !store.get(g.key)?.seen }))
      .sort((a, b) => Number(b.isNew) - Number(a.isNew) || b.count - a.count || a.key.localeCompare(b.key));
    const seconds = Math.round((end - this.start) / 1000);
    const lines = [`${this.total} records in ${formatSeconds(seconds)} (previous window: ${prevTotal}), ${rows.length} kinds; kinds not seen before are marked NEW:`];
    let size = lines[0].length;
    let omitted = 0;
    for (const r of rows) {
      const line = `${r.isNew ? "NEW " : ""}×${r.count}  ${clip(r.sample, 300)}`;
      if (omitted || size + line.length > SUMMARY_CHARS) {
        omitted++;
        continue;
      }
      lines.push(line);
      size += line.length + 1;
    }
    if (omitted) lines.push(`(+${omitted} more kinds)`);
    const common = { start: new Date(this.start).toISOString(), end: new Date(end).toISOString(), summary: lines.join("\n") };
    const plain = {
      ...common,
      seconds,
      total: this.total,
      prev_total: prevTotal,
      kinds: rows.length,
      groups: rows.map((r) => ({ key: r.key, count: r.count, sample: r.sample, new: r.isNew })),
    };
    const cel = new Map<string, CelInput>([
      ...(Object.entries(common) as [string, CelInput][]),
      ["seconds", BigInt(seconds)],
      ["total", BigInt(this.total)],
      ["prev_total", BigInt(prevTotal)],
      ["kinds", BigInt(rows.length)],
      ["groups", rows.map((r) => new Map<string, CelInput>([["key", r.key], ["count", BigInt(r.count)], ["sample", r.sample], ["new", r.isNew]]))],
    ]);
    return { plain, cel: cel as CelInput };
  }
}

function formatSeconds(s: number): string {
  if (s >= 3600 && s % 3600 === 0) return `${s / 3600}h`;
  if (s >= 60 && s % 60 === 0) return `${s / 60}m`;
  return `${s}s`;
}
