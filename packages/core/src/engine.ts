import { parse, plan } from "@bufbuild/cel";
import { checkParsed, checkPlanned, HINT, RuleError } from "./cel/check.ts";
import { env, type Answers, type Planned } from "./cel/env.ts";
import { Program } from "./program.ts";
import { HttpError, type Answer, type Client, type Question } from "./typesafe/client.ts";

export const NO_KEY = "no Jev API key (TypeSafe, Vercel AI Gateway or OpenRouter): `jevable providers` shows where jevable looks";

/**
 * What every program shares: the Jev client, an answer cache (the same
 * question on the same material is asked once), and counters.
 */
export class Engine implements Answers {
  readonly client: Client;
  readonly stats = { calls: 0, cacheHits: 0, tokens: 0 };
  /** The first error retrying cannot fix (no key, a refused key). */
  fatal: Error | undefined;
  private readonly answers = new Map<string, Answer>();
  private readonly inflight = new Map<string, Promise<Answer>>();

  constructor(client: Client) {
    this.client = client;
  }

  get model(): string {
    return this.client.model;
  }

  /** Compiles a rule (must yield true or false) or a key (anything); throws a RuleError when it cannot work. */
  compile(source: string, kind: "rule" | "key" = "rule"): Program {
    const text = source.trim();
    if (!text) throw new RuleError(`the ${kind} is empty`);
    let parsed;
    try {
      parsed = parse(text);
    } catch (err) {
      throw new RuleError(`${(err as Error).message}\n\n${HINT}`);
    }
    checkParsed(parsed.expr, kind);
    const run = plan(env, parsed) as Planned;
    checkPlanned(run, kind);
    return new Program(this, text, run);
  }

  cached(key: string): Answer | undefined {
    return this.answers.get(key);
  }

  /** Asks one question unless its answer is known or on its way; reports whether this call asked. */
  async ask(key: string, state: unknown, q: Question, signal?: AbortSignal): Promise<boolean> {
    if (this.fatal) throw this.fatal;
    if (this.answers.has(key)) return false;
    const running = this.inflight.get(key);
    if (running) {
      await running;
      return false;
    }
    if (!this.client.apiKey) throw (this.fatal = new Error(NO_KEY));
    const request = (async () => {
      this.stats.calls++;
      const res = await this.client.ask(state, { q }, signal);
      this.stats.tokens += res.usage?.input_tokens ?? 0;
      return res.answers.q;
    })();
    this.inflight.set(key, request);
    try {
      this.answers.set(key, await request);
      return true;
    } catch (err) {
      if (err instanceof HttpError && err.fatal) {
        this.fatal ??= new Error(`Jev refused the request (${err.message}) — check the API key and the judge arguments`);
        throw this.fatal;
      }
      throw err;
    } finally {
      this.inflight.delete(key);
    }
  }
}
