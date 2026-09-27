// A minimal client for TypeSafe's System One endpoint
// (https://docs.typesafe.ai/api): one state, a map of typed questions, one
// typed answer per question. Other providers serve the same API (providers.ts).

export const DEFAULT_BASE_URL = "https://api.typesafe.ai";
// Pinned rather than `jev-latest`: thresholds are tuned against one model,
// and an alias moves without a change on our side.
export const DEFAULT_MODEL = "jev-1.13.0";

export type QuestionType = "noul" | "choice" | "score";

/**
 * One typed question. Criteria: noul — undefined or {true, false};
 * choice — option → description (or null); score — ordered level list.
 */
export interface Question {
  type: QuestionType;
  instructions: string;
  criteria?: unknown;
}

export interface Answer {
  type: QuestionType;
  noul?: number;
  choice?: string;
  score?: number;
  probabilities?: Record<string, number>;
  confidence?: number;
}

export interface Result {
  model: string;
  answers: Record<string, Answer>;
  usage: { input_tokens: number; output_tokens: number };
}

/** A non-2xx answer from the API. */
export class HttpError extends Error {
  readonly status: number;
  constructor(provider: string, status: number, body: string) {
    super(`${provider} returned ${status}: ${reason(body)}`);
    this.status = status;
  }
  /** Retrying cannot help: a bad key or a malformed request. */
  get fatal(): boolean {
    return this.status === 401 || this.status === 403 || this.status === 422;
  }
}

/** The message in an error body — TypeSafe's {message}, a gateway's {error: {message}} — else the body itself. */
function reason(body: string): string {
  try {
    const j = JSON.parse(body);
    const m = j?.error?.message ?? j?.message ?? j?.error;
    if (typeof m === "string") return m;
  } catch {}
  return body.slice(0, 512);
}

export class Client {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
  /** Who serves Jev here, for messages. */
  readonly provider: string;

  constructor(opts: { apiKey?: string; baseUrl?: string; model?: string; provider?: string } = {}) {
    this.apiKey = opts.apiKey ?? "";
    this.baseUrl = (opts.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.model = opts.model || DEFAULT_MODEL;
    this.provider = opts.provider || "TypeSafe";
  }

  /** Evaluates every question against state in one call, retrying once on anything but a fatal error. */
  async ask(state: unknown, questions: Record<string, Question>, signal?: AbortSignal): Promise<Result> {
    try {
      return await this.request(state, questions, signal);
    } catch (err) {
      if ((err instanceof HttpError && err.fatal) || signal?.aborted) throw err;
      await new Promise((r) => setTimeout(r, 1000));
      return this.request(state, questions, signal);
    }
  }

  private async request(state: unknown, questions: Record<string, Question>, signal?: AbortSignal): Promise<Result> {
    const timeout = AbortSignal.timeout(15_000);
    const res = await fetch(`${this.baseUrl}/v1/systemone`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ state, model: this.model, questions }),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    const text = await res.text();
    if (!res.ok) throw new HttpError(this.provider, res.status, text);
    const out = JSON.parse(text) as Result;
    for (const key of Object.keys(questions)) {
      if (!out.answers?.[key]) throw new Error(`${this.provider}: answer ${JSON.stringify(key)} missing`);
    }
    return out;
  }
}
