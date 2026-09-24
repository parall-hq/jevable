import { isCelError, type CelInput } from "@bufbuild/cel";
import { evaluateWith, type Pass, type Planned } from "./cel/env.ts";
import { describe } from "./cel/check.ts";
import { fromCel } from "./cel/values.ts";
import type { Engine } from "./engine.ts";
import type { Bindings, Call, Outcome } from "./types.ts";

/** A compiled rule or key expression. Safe to share between concurrent evaluations. */
export class Program {
  readonly source: string;
  private readonly engine: Engine;
  private readonly run: Planned;

  constructor(engine: Engine, source: string, run: Planned) {
    this.engine = engine;
    this.source = source;
    this.run = run;
  }

  /** Evaluates a rule. An evaluation error (a missing field, a failed judge call) means no pass. */
  async match(vars: Bindings, signal?: AbortSignal): Promise<Outcome> {
    const r = await this.evaluate(vars, signal);
    if (r.error) return { pass: false, calls: r.calls, error: r.error };
    if (typeof r.out !== "boolean") return { pass: false, calls: r.calls, error: new Error(`rule yielded ${describe(r.out)}, not true or false`) };
    return { pass: r.out, calls: r.calls };
  }

  /** Evaluates a key: strings as they are, anything else as JSON. */
  async key(vars: Bindings, signal?: AbortSignal): Promise<string> {
    const r = await this.evaluate(vars, signal);
    if (r.error) throw r.error;
    return typeof r.out === "string" ? r.out : JSON.stringify(fromCel(r.out));
  }

  /**
   * Evaluates in passes until no question is missing: each pass that lacks
   * an answer asks for it, and the next pass starts over with it known. Plain
   * conditions that decide the rule first mean a question is never reached,
   * so never asked.
   */
  private async evaluate(vars: Bindings, signal?: AbortSignal): Promise<{ out?: unknown; calls: Call[]; error?: Error }> {
    const ctx = { line: vars.line ?? "", json: vars.json ?? null, window: vars.window ?? null } as Record<string, CelInput>;
    const fetched = new Set<string>();
    for (let round = 0; round < 64; round++) {
      const pass: Pass = { answers: this.engine, calls: [], keys: [] };
      const out = evaluateWith(pass, this.run, ctx);
      if (!pass.pending) {
        for (const k of pass.keys) if (!fetched.has(k)) this.engine.stats.cacheHits++;
        if (isCelError(out)) return { calls: pass.calls, error: new Error(out.message) };
        return { out, calls: pass.calls };
      }
      try {
        if (await this.engine.ask(pass.pending.key, pass.pending.state, pass.pending.q, signal)) fetched.add(pass.pending.key);
      } catch (err) {
        return { calls: pass.calls, error: err as Error };
      }
    }
    return { calls: [], error: new Error("rule asked too many questions") };
  }
}
