import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Call, Outcome } from "@jevable/core";

export interface KeyState {
  /** The key's verdict: judged once. */
  verdict?: { pass: boolean; judge?: Call[] };
  /** When the key was last emitted (ISO time). */
  last_emit?: string;
  /** Matches held back since the last emit. */
  suppressed?: number;
  /** A window has seen the key. */
  seen?: boolean;
}

/** What jevable remembers per key; with a path, it survives restarts. */
export class Store {
  readonly path: string | undefined;
  private readonly keys: Map<string, KeyState>;
  private readonly inflight = new Map<string, Promise<Outcome>>();
  private dirty = false;

  constructor(path?: string) {
    this.path = path;
    this.keys = new Map();
    if (!path) return;
    let text: string;
    try {
      text = readFileSync(path, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }
    const file = JSON.parse(text) as { keys?: Record<string, KeyState> };
    for (const [k, v] of Object.entries(file.keys ?? {})) this.keys.set(k, v);
  }

  get(key: string): KeyState | undefined {
    return this.keys.get(key);
  }

  update(key: string, fn: (ks: KeyState) => void): void {
    let ks = this.keys.get(key);
    if (!ks) this.keys.set(key, (ks = {}));
    fn(ks);
    this.dirty = true;
  }

  /**
   * The key's verdict, judged once even when records of the same key arrive
   * together. Failed judgements are not remembered: the next record tries again.
   */
  async verdictFor(key: string, judge: () => Promise<Outcome>): Promise<Outcome> {
    const v = this.keys.get(key)?.verdict;
    if (v) return { pass: v.pass, calls: v.judge ?? [] };
    let running = this.inflight.get(key);
    if (!running) {
      running = judge().then((out) => {
        if (!out.error) this.update(key, (ks) => (ks.verdict = { pass: out.pass, judge: out.calls.length ? out.calls : undefined }));
        return out;
      });
      this.inflight.set(key, running);
      running.finally(() => this.inflight.delete(key));
    }
    return running;
  }

  /** Writes the state file, if there is one and anything changed. */
  save(): void {
    if (!this.path || !this.dirty) return;
    mkdirSync(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, JSON.stringify({ keys: Object.fromEntries(this.keys) }), { mode: 0o600 });
    renameSync(tmp, this.path);
    this.dirty = false;
  }
}
