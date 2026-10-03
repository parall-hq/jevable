// A fake System One endpoint for tests: @jevable/core/testing.
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Engine } from "./engine.ts";
import { Client, DEFAULT_MODEL, type Answer, type Question } from "./typesafe/client.ts";

/** Decides one answer; state is the request's state as JSON (a string material arrives quoted). */
export type Answerer = (state: string, q: Question) => Omit<Answer, "type">;

export interface FakeJev {
  url: string;
  /** Requests received so far. */
  calls(): number;
  /** A fresh engine talking to this fake with the key it accepts. */
  engine(): Engine;
  close(): Promise<void>;
}

/** The API key the fake accepts; any other is refused with 401. */
export const FAKE_KEY = "test-key";
/** The models the fake serves and lists at /v1/models; any other is refused with 404. */
export const FAKE_MODELS = [DEFAULT_MODEL, "fake-d1"];

/** Starts a fake that bills 10 tokens per request. */
export async function fakeJev(answer: Answerer): Promise<FakeJev> {
  let calls = 0;
  const server = createServer((req, res) => {
    calls++;
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.headers.authorization !== `Bearer ${FAKE_KEY}`) {
        res.writeHead(401).end('{"error":"invalid api key"}');
        return;
      }
      if (req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ models: FAKE_MODELS.map((name) => ({ name })) }));
        return;
      }
      const { state, model, questions } = JSON.parse(body) as { state: unknown; model: string; questions: Record<string, Question> };
      if (!FAKE_MODELS.includes(model)) {
        res.writeHead(404).end(`{"error":"no model ${model}"}`);
        return;
      }
      const answers: Record<string, Answer> = {};
      for (const [k, q] of Object.entries(questions)) answers[k] = { type: q.type, ...answer(JSON.stringify(state), q) };
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ model, answers, usage: { input_tokens: 10, output_tokens: 0 } }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    url,
    calls: () => calls,
    engine: () => new Engine(new Client({ apiKey: FAKE_KEY, baseUrl: url })),
    close: () =>
      new Promise((r) => {
        server.closeAllConnections();
        server.close(() => r());
      }),
  };
}

/** Answers yes (0.9) when the material mentions "outage", else 0.1; choice and score likewise. */
export const outage: Answerer = (state, q) => {
  const hit = state.includes("outage");
  if (q.type === "choice") return { probabilities: hit ? { infra: 0.8, other: 0.2 } : { infra: 0.1, other: 0.9 } };
  if (q.type === "score") return { score: hit ? 1.8 : 0.2 };
  return { noul: hit ? 0.9 : 0.1 };
};
