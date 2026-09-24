// The CEL environment: judge.boolean / judge.choice / judge.score and
// fingerprint, and the evaluation pass they report into.
//
// CEL evaluation is synchronous and a Jev call is not, so a rule is
// evaluated in passes (program.ts): a judge call whose answer is not known
// yet records the question in the pass and fails it; the question is asked;
// the rule is evaluated again.

import { createHash } from "node:crypto";
import { celEnv, celFunc, CelScalar, mapType, type CelEnv, type CelInput, type CelValue } from "@bufbuild/cel";
import { strings } from "@bufbuild/cel/ext";
import { cutLongStrings, fingerprint } from "../text.ts";
import type { Answer, Question, QuestionType } from "../typesafe/client.ts";
import type { Call } from "../types.ts";
import { fromCel } from "./values.ts";

/** Where known answers come from; null in a pass means the compile-time dry run. */
export interface Answers {
  cached(key: string): Answer | undefined;
}

/** One evaluation pass: the answers it may use, the first question it lacked, the calls it made. */
export interface Pass {
  answers: Answers | null;
  pending?: { key: string; state: unknown; q: Question };
  calls: Call[];
  keys: string[];
}

export type Planned = (ctx: Record<string, CelInput>) => unknown;

// The pass in progress. Evaluation is synchronous, so one slot is enough.
let current: Pass | undefined;

/** Runs a planned expression within a pass; a thrown error is returned like a CEL error. */
export function evaluateWith(pass: Pass, run: Planned, ctx: Record<string, CelInput>): unknown {
  current = pass;
  try {
    return run(ctx);
  } catch (err) {
    return err;
  } finally {
    current = undefined;
  }
}

const FN: Record<QuestionType, Call["fn"]> = { noul: "boolean", choice: "choice", score: "score" };

function judge(type: QuestionType, material: CelValue, question: string, criteria?: CelValue): CelInput {
  const pass = current;
  if (!pass) throw new Error("judge.* evaluated outside a rule");
  const q: Question = { type, instructions: question };
  if (criteria !== undefined) q.criteria = fromCel(criteria);
  if (!pass.answers) return answerValue(type, probeAnswer(type, q));
  const state = cutLongStrings(fromCel(material));
  if (state === null || state === undefined || state === "") throw new Error("judge material is empty");
  const key = cacheKey(q, state);
  const ans = pass.answers.cached(key);
  if (!ans) {
    pass.pending ??= { key, state, q };
    throw new Error("waiting for Jev");
  }
  const call: Call = { fn: FN[type], question };
  if (type === "choice") call.options = ans.probabilities ?? {};
  else call.value = (type === "score" ? ans.score : ans.noul) ?? 0;
  pass.calls.push(call);
  pass.keys.push(key);
  return answerValue(type, ans);
}

function answerValue(type: QuestionType, ans: Answer): CelInput {
  if (type === "choice") return new Map(Object.entries(ans.probabilities ?? {})) as CelInput;
  return (type === "score" ? ans.score : ans.noul) ?? 0;
}

/** A neutral answer for the compile-time dry run; nothing is sent. */
function probeAnswer(type: QuestionType, q: Question): Answer {
  if (type === "choice") {
    const options = Object.keys((q.criteria as Record<string, unknown>) ?? {});
    return { type, probabilities: Object.fromEntries(options.map((o) => [o, 1 / Math.max(options.length, 1)])) };
  }
  return type === "score" ? { type, score: 0 } : { type, noul: 0.5 };
}

function cacheKey(q: Question, state: unknown): string {
  return createHash("sha256").update(JSON.stringify([q.type, q.instructions, q.criteria ?? null, state])).digest("hex");
}

const D = CelScalar.DYN;
const S = CelScalar.STRING;

export const env: CelEnv = celEnv({
  funcs: [
    ...strings,
    celFunc("judge.boolean", [D, S], CelScalar.DOUBLE, (m, q) => judge("noul", m, q) as number),
    celFunc("judge.boolean", [D, S, D], CelScalar.DOUBLE, (m, q, c) => judge("noul", m, q, c) as number),
    celFunc("judge.choice", [D, S, D], mapType(S, CelScalar.DOUBLE), (m, q, c) => judge("choice", m, q, c) as never),
    celFunc("judge.score", [D, S, D], CelScalar.DOUBLE, (m, q, c) => judge("score", m, q, c) as number),
    celFunc("fingerprint", [S], S, (s) => fingerprint(s)),
  ],
});
