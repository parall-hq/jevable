import type { CelInput } from "@bufbuild/cel";

/** One judge question asked while evaluating a rule, and its answer. */
export interface Call {
  fn: "boolean" | "choice" | "score";
  question: string;
  /** boolean: probability of yes; score: weighted level. */
  value?: number;
  /** choice: probability of each option. */
  options?: Record<string, number>;
}

/** The variables a rule sees; missing ones are empty. */
export interface Bindings {
  line?: string;
  json?: CelInput;
  window?: CelInput;
}

export interface Outcome {
  pass: boolean;
  calls: Call[];
  error?: Error;
}
