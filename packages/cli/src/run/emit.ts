import type { Call } from "@jevable/core";
import type { Store } from "./store.ts";

export interface Output {
  write(chunk: string): unknown;
}

export interface EmitOptions {
  json: boolean;
  all: boolean;
  /** --key without --window: each key is emitted once, or once per cooldown. */
  keyed: boolean;
  cooldownMs: number;
  max: number;
  now: () => number;
}

/** One judged record, as the pipeline hands it over. */
export interface Judged {
  line: string;
  json: unknown;
  key?: string;
  pass: boolean;
  calls: Call[];
  error?: Error;
}

/**
 * Writes what passed, one line each, so a watcher (Claude Code's Monitor, a
 * background shell) sees it at once, and holds back repeats: with --key each
 * key is emitted once, or once per --cooldown; without --key, --cooldown
 * holds back everything after an emit.
 */
export class Emitter {
  passed = 0;
  emitted = 0;
  private readonly out: Output;
  private readonly store: Store;
  private readonly o: EmitOptions;

  constructor(out: Output, store: Store, o: EmitOptions) {
    this.out = out;
    this.store = store;
    this.o = o;
  }

  /** Handles one judged record; reports whether -m is reached. */
  record(it: Judged): boolean {
    if (!this.o.json && !this.o.all) return this.pass(it.pass, it.key ?? "", () => this.line(it.line));
    return this.pass(it.pass, it.key ?? "", (suppressed) =>
      this.line(
        JSON.stringify({
          line: it.json === null ? it.line : undefined,
          json: it.json ?? undefined,
          key: it.key,
          pass: this.o.all ? it.pass : undefined,
          judge: it.calls.length ? it.calls : undefined,
          suppressed: suppressed || undefined,
          error: this.o.all ? it.error?.message : undefined,
        }),
      ),
    );
  }

  /** Handles one judged window; reports whether -m is reached. */
  window(value: Record<string, unknown>, pass: boolean, calls: Call[], error?: Error): boolean {
    const { summary: _, ...shown } = value;
    if (Array.isArray(shown.groups)) shown.groups = shown.groups.slice(0, 20);
    return this.pass(pass, "", (suppressed) =>
      this.line(
        JSON.stringify({
          window: shown,
          pass: this.o.all ? pass : undefined,
          judge: calls.length ? calls : undefined,
          suppressed: suppressed || undefined,
          error: this.o.all ? error?.message : undefined,
        }),
      ),
    );
  }

  /** Emits through write when the result passed and is not held back; --all writes everything. */
  private pass(ok: boolean, key: string, write: (suppressed: number) => void): boolean {
    if (ok) this.passed++;
    if (this.o.all) {
      write(0);
      return ok && this.o.max > 0 && this.passed >= this.o.max;
    }
    if (!ok) return false;
    let emit = true;
    let suppressed = 0;
    if (this.o.keyed || this.o.cooldownMs > 0) {
      const now = this.o.now();
      this.store.update(key, (ks) => {
        const last = ks.last_emit ? Date.parse(ks.last_emit) : undefined;
        if (last !== undefined && (this.o.cooldownMs === 0 || now - last < this.o.cooldownMs)) {
          ks.suppressed = (ks.suppressed ?? 0) + 1;
          emit = false;
          return;
        }
        suppressed = ks.suppressed ?? 0;
        ks.suppressed = undefined;
        ks.last_emit = new Date(now).toISOString();
      });
    }
    if (!emit) return false;
    write(suppressed);
    this.emitted++;
    this.store.save();
    return this.o.max > 0 && this.emitted >= this.o.max;
  }

  private line(s: string): void {
    this.out.write(s + "\n");
  }
}
