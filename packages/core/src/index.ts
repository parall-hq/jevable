// @jevable/core: compile a rule once, match records against it.
//
//   const engine = new Engine(new Client({ apiKey: process.env.TYPESAFE_API_KEY }));
//   // or another provider, or another decision model: new Client({ apiKey, baseUrl: p.baseUrl, path: p.path, model: p.model, provider: p.label })
//   const rule = engine.compile(`judge.boolean(line, "Is this an outage?") >= 0.7`);
//   const { pass, calls } = await rule.match({ line: "checkout returns 500 for everyone" });

export { Engine, NO_KEY } from "./engine.ts";
export { Program } from "./program.ts";
export { RuleError, isRuleBug } from "./cel/check.ts";
export { toCel, fromCel } from "./cel/values.ts";
export { clip, cutLongStrings, fingerprint, parseRecord } from "./text.ts";
export { Client, HttpError, DEFAULT_BASE_URL, DEFAULT_MODEL, DEFAULT_PATH, type Answer, type Question, type QuestionType, type Result } from "./typesafe/client.ts";
export { PROVIDERS, lookup, choose, whose, type Provider, type Found } from "./typesafe/providers.ts";
export type { Bindings, Call, Outcome } from "./types.ts";
export type { CelInput } from "@bufbuild/cel";
