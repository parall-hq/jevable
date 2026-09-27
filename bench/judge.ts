// Compares Jev with general LLMs as the judge behind jevable rules, on the
// labelled samples in cases/: accuracy of the whole rule, latency and cost
// per judgement, and how honest the probabilities are.
//
// Every model sees exactly what jevable would send Jev (material, question,
// criteria), captured from the engine itself; its answer is then put back
// into the same rule with the same threshold.
//
//   TYPESAFE_API_KEY=... OPENROUTER_API_KEY=... \
//     node --conditions=jevable-source bench/judge.ts [--holdout] [model ...]
//
// --holdout runs the holdout-yes/no.txt samples: labelled apart and never
// used to write the rules, so they do not favour the model the rules were
// tuned with (Jev).
//
// Models are OpenRouter ids; "jev" is Jev through TypeSafe. Raw results go to
// bench/results/<date>.json.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client, parseRecord, toCel, type Answer, type Question } from "@jevable/core";
import { fakeJev } from "@jevable/core/testing";

const ROOT = new URL("../", import.meta.url).pathname;
const CASES = join(ROOT, "cases");

const DEFAULT_MODELS = [
  "jev",
  "openai/gpt-6-luna",
  "openai/gpt-5-nano",
  "openai/gpt-4o-mini",
  "google/gemini-3.5-flash-lite",
  "google/gemini-3.1-flash-lite",
  "google/gemini-2.5-flash-lite",
  "anthropic/claude-haiku-4.5",
  "deepseek/deepseek-v4.1-flash",
  "deepseek/deepseek-v4-flash",
  "qwen/qwen3.8-flash",
  "qwen/qwen3.7-flash",
  "xiaomi/mimo-v2.6-flash",
  "z-ai/glm-5.3-flash",
  "nvidia/nemotron-3.5-lightning",
  "inception/mercury-2.5",
  "inclusionai/ling-3.0-flash",
  "upstage/solar-mini4",
];

// Which answer means "wake" for the choice cases; boolean cases use P(yes).
const YES_PROBABILITY: Record<string, (a: Answer) => number> = {
  tibo: (a) => a.probabilities?.reset_now ?? 0,
  releases: (a) => 1 - (a.probabilities?.other ?? 1),
};

interface Item {
  id: string; // case#index
  kase: string;
  rule: string;
  text: string;
  label: boolean;
  q?: Question; // absent when plain conditions decided the rule
  state?: unknown;
}

interface Judged {
  answer: Answer;
  /** Whether the rule, fed this answer, came out as labelled. */
  correct?: boolean;
  ms: number;
  cost: number;
  inputTokens: number;
  probabilities: boolean; // real probabilities, not a bare yes/no
  raw?: string;
  error?: string;
}

// ---------------------------------------------------------------- samples

/** Loads every labelled sample and captures the judge request jevable makes for it. */
async function loadItems(set: "samples" | "holdout"): Promise<Item[]> {
  const items: Item[] = [];
  let current: { state: unknown; q: Question } | undefined;
  const capture = await fakeJev((state, q) => {
    current = { state: JSON.parse(state), q };
    if (q.type === "choice") {
      const keys = Object.keys(q.criteria as object);
      return { probabilities: Object.fromEntries(keys.map((k) => [k, 1 / keys.length])) };
    }
    return q.type === "score" ? { score: 0 } : { noul: 0.5 };
  });
  for (const kase of readdirSync(CASES, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    const dir = join(CASES, kase);
    const rule = readFileSync(join(dir, "rule.cel"), "utf8");
    const files = set === "holdout" ? ([["holdout-yes.txt", true], ["holdout-no.txt", false]] as const) : ([["yes.txt", true], ["no.txt", false]] as const);
    for (const [file, label] of files) {
      if (!existsSync(join(dir, file))) continue;
      const lines = readFileSync(join(dir, file), "utf8").split("\n").filter((l) => l.trim());
      for (const text of lines) {
        current = undefined;
        const { json } = parseRecord(text);
        await capture.engine().compile(rule).match({ line: text, json: toCel(json) });
        // Set by the capture callback during match(); TypeScript cannot see that.
        const seen = current as { state: unknown; q: Question } | undefined;
        items.push({ id: `${kase}#${items.length}`, kase, rule, text, label, q: seen?.q, state: seen?.state });
      }
    }
  }
  await capture.close();
  return items;
}

// ---------------------------------------------------------------- judges

async function askJev(client: Client, item: Item): Promise<Judged> {
  const t = performance.now();
  const res = await client.ask(item.state, { q: item.q! });
  const ms = performance.now() - t;
  const inputTokens = res.usage?.input_tokens ?? 0;
  return { answer: res.answers.q, ms, cost: (inputTokens * 0.042) / 1e6, inputTokens, probabilities: true };
}

const LETTERS = "ABCDEFGHIJ";

function prompt(item: Item): { system: string; user: string; options?: string[] } {
  const q = item.q!;
  const material = typeof item.state === "string" ? item.state : JSON.stringify(item.state, null, 2);
  const system = "You classify text for an automated filter. Reply with only the answer, no explanation.";
  if (q.type === "choice") {
    const criteria = q.criteria as Record<string, string | null>;
    const options = Object.keys(criteria);
    const lines = options.map((o, i) => `${LETTERS[i]}: ${o}${criteria[o] ? ` — ${criteria[o]}` : ""}`);
    return {
      system,
      options,
      user: `Material:\n${material}\n\nQuestion: ${q.instructions}\nOptions:\n${lines.join("\n")}\n\nReply with exactly one letter: ${options.map((_, i) => LETTERS[i]).join(", ")}.`,
    };
  }
  const c = (q.criteria ?? {}) as { true?: string; false?: string };
  const crit = [c.true ? `Answer "yes" if: ${c.true}` : "", c.false ? `Answer "no" if: ${c.false}` : ""].filter(Boolean).join("\n");
  return { system, user: `Material:\n${material}\n\nQuestion: ${q.instructions}\n${crit}\n\nReply with exactly one word: yes or no.` };
}

// OpenRouter's public model list: which parameters each model accepts.
const SUPPORTED: Record<string, string[]> = Object.fromEntries(
  ((await (await fetch("https://openrouter.ai/api/v1/models")).json()) as { data: { id: string; supported_parameters?: string[] }[] }).data.map((m) => [m.id, m.supported_parameters ?? []]),
);

// How each model runs as a gate: least reasoning, and token probabilities
// where some provider serves them (require_parameters routes only to those).
// OpenAI's reasoning models take an effort instead and refuse temperature.
function settings(model: string): Record<string, unknown> {
  if (/openai\/gpt-6/.test(model)) return { reasoning: { effort: "none" } };
  if (/openai\/gpt-5/.test(model)) return { reasoning: { effort: "minimal" } };
  const can = new Set(SUPPORTED[model] ?? []);
  return {
    ...(can.has("temperature") ? { temperature: 0 } : {}),
    ...(can.has("reasoning") ? { reasoning: MANDATORY_REASONING.has(model) ? { effort: "minimal" } : { enabled: false } } : {}),
    ...(can.has("logprobs") ? { logprobs: true, top_logprobs: 5, provider: { require_parameters: true } } : {}),
  };
}

// Models whose reasoning cannot be switched off run at the lowest effort.
const MANDATORY_REASONING = new Set<string>();

/** Retries upstream rate limits (429) with backoff, and mandatory reasoning at the lowest effort. */
async function askOpenRouter(key: string, model: string, item: Item): Promise<Judged> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await askOpenRouterOnce(key, model, item);
    } catch (err) {
      const msg = String((err as Error).message);
      if (/Reasoning is mandatory/.test(msg) && !MANDATORY_REASONING.has(model)) {
        MANDATORY_REASONING.add(model);
        continue;
      }
      if (attempt >= 5 || !/"code":429/.test(msg)) throw err;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    }
  }
}

async function askOpenRouterOnce(key: string, model: string, item: Item): Promise<Judged> {
  const p = prompt(item);
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: p.system },
      { role: "user", content: p.user },
    ],
    max_tokens: 400,
    usage: { include: true },
    ...settings(model),
  };
  const t = performance.now();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const json = (await res.json()) as any;
  const ms = performance.now() - t;
  if (!res.ok || json.error) throw new Error(JSON.stringify(json.error ?? json).slice(0, 300));
  const choice = json.choices?.[0];
  const text: string = (choice?.message?.content ?? "").trim();
  const top: { token: string; logprob: number }[] = choice?.logprobs?.content?.[0]?.top_logprobs ?? [];
  const usage = json.usage ?? {};
  const base = { ms, cost: usage.cost ?? 0, inputTokens: usage.prompt_tokens ?? 0, raw: text };

  if (p.options) {
    const letters = p.options.map((_, i) => LETTERS[i]);
    const mass = letters.map((l) => sumProb(top, (tok) => tok === l || tok === `${l}:` || tok === `${l}.`));
    const total = mass.reduce((a, b) => a + b, 0);
    let probabilities: Record<string, number>;
    let real = total > 0;
    if (real) probabilities = Object.fromEntries(p.options.map((o, i) => [o, mass[i] / total]));
    else {
      const picked = letters.findIndex((l) => text.toUpperCase().startsWith(l));
      probabilities = Object.fromEntries(p.options.map((o, i) => [o, i === picked ? 1 : 0]));
    }
    return { ...base, answer: { type: "choice", probabilities }, probabilities: real };
  }
  const yes = sumProb(top, (tok) => tok.toLowerCase() === "yes");
  const no = sumProb(top, (tok) => tok.toLowerCase() === "no");
  if (yes + no > 0) return { ...base, answer: { type: "noul", noul: yes / (yes + no) }, probabilities: true };
  return { ...base, answer: { type: "noul", noul: /^\W*yes/i.test(text) ? 1 : 0 }, probabilities: false };
}

function sumProb(top: { token: string; logprob: number }[], match: (tok: string) => boolean): number {
  return top.filter((t) => match(t.token.trim())).reduce((s, t) => s + Math.exp(t.logprob), 0);
}

// ---------------------------------------------------------------- scoring

/** Puts a model's answer back into the item's rule and reports whether the rule passes. */
async function passesWith(item: Item, answer: Answer | undefined): Promise<boolean> {
  const replay = await fakeJev(() => answer ?? { noul: 0 });
  const { json } = parseRecord(item.text);
  const out = await replay.engine().compile(item.rule).match({ line: item.text, json: toCel(json) });
  await replay.close();
  return out.pass;
}

function yesProbability(item: Item, a: Answer): number {
  return YES_PROBABILITY[item.kase]?.(a) ?? a.noul ?? 0;
}

function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0;
}

async function pool<T, R>(xs: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(xs.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      for (let i = next++; i < xs.length; i = next++) out[i] = await fn(xs[i]);
    }),
  );
  return out;
}

// ---------------------------------------------------------------- main

const args = process.argv.slice(2);
const set = args.includes("--holdout") ? "holdout" : "samples";
const named = args.filter((a) => !a.startsWith("--"));
const models = named.length ? named : DEFAULT_MODELS;
const items = await loadItems(set);
const judged = items.filter((i) => i.q);
console.error(`${set}: ${items.length} samples, ${judged.length} reach the judge (${items.length - judged.length} decided by plain conditions), ${models.length} models`);

const jev = new Client({ apiKey: process.env.TYPESAFE_API_KEY });
const orKey = process.env.OPENROUTER_API_KEY ?? "";
const results: Record<string, Record<string, Judged>> = {};

await Promise.all(
  models.map(async (model) => {
    results[model] = {};
    await pool(judged, 3, async (item) => {
      try {
        results[model][item.id] = model === "jev" ? await askJev(jev, item) : await askOpenRouter(orKey, model, item);
      } catch (err) {
        results[model][item.id] = { answer: { type: "noul", noul: 0 }, ms: 0, cost: 0, inputTokens: 0, probabilities: false, error: String((err as Error).message ?? err) };
      }
    });
    console.error(`  done: ${model}`);
  }),
);

const rows: string[] = [];
const cases = [...new Set(judged.map((i) => i.kase))];
rows.push(["model", "right", ...cases, "p50 ms", "p95 ms", "$/1k", "brier", "sure&wrong", "probs", "errors"].join("\t"));
for (const model of models) {
  const r = results[model];
  let right = 0;
  let brier = 0;
  let sureWrong = 0;
  const perCase: Record<string, [number, number]> = {};
  for (const item of judged) {
    const j = r[item.id];
    const ok = !j.error && (await passesWith(item, j.answer)) === item.label;
    j.correct = ok;
    right += Number(ok);
    perCase[item.kase] ??= [0, 0];
    perCase[item.kase][0] += Number(ok);
    perCase[item.kase][1]++;
    const p = j.error ? 0.5 : yesProbability(item, j.answer);
    brier += (p - Number(item.label)) ** 2;
    if (!j.error && ((item.label && p <= 0.1) || (!item.label && p >= 0.9))) sureWrong++;
  }
  const ok = Object.values(r).filter((j) => !j.error);
  const ms = ok.map((j) => j.ms);
  const cost = ok.reduce((s, j) => s + j.cost, 0) / Math.max(ok.length, 1);
  const real = ok.filter((j) => j.probabilities).length;
  rows.push(
    [
      model,
      `${right}/${judged.length}`,
      ...cases.map((c) => `${perCase[c]?.[0]}/${perCase[c]?.[1]}`),
      Math.round(quantile(ms, 0.5)),
      Math.round(quantile(ms, 0.95)),
      (cost * 1000).toFixed(4),
      (brier / judged.length).toFixed(3),
      sureWrong,
      `${real}/${ok.length}`,
      Object.values(r).filter((j) => j.error).length,
    ].join("\t"),
  );
}
console.log(rows.join("\n"));

mkdirSync(join(ROOT, "bench/results"), { recursive: true });
const file = join(ROOT, "bench/results", `${new Date().toISOString().slice(0, 10)}-${set}.json`);
// Runs accumulate per set: a model run again replaces its own results only.
const previous = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { models: [], results: {} };
writeFileSync(
  file,
  JSON.stringify(
    {
      models: [...new Set([...previous.models, ...models])],
      items: judged.map(({ id, kase, label, text }) => ({ id, kase, label, text })),
      results: { ...previous.results, ...results },
    },
    null,
    1,
  ),
);
console.error(`raw results: ${file}`);
