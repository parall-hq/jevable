// Compile-time checks: catch a rule that cannot work before any record is
// read, since a rule that silently never passes looks exactly like quiet.

import { isCelError, type CelInput } from "@bufbuild/cel";
import { evaluateWith, type Planned } from "./env.ts";

/** A rule that cannot work as written. */
export class RuleError extends Error {}

const VARIABLES = new Set(["line", "json", "window"]);
// Identifiers CEL itself provides: type names usable in `type(x) == int`.
const BUILTIN_IDENTS = new Set(["int", "uint", "double", "bool", "string", "bytes", "list", "map", "null_type", "type"]);
export const HINT = "Variables: line, json (the parsed line) and, with --window, window. Run `jev guide` for functions and examples.";
const COMPARE = `compare it, e.g. judge.boolean(line, "...") >= 0.7`;

// Values for the dry run, shaped like real ones.
const PROBE = {
  line: "probe",
  json: new Map() as CelInput,
  window: new Map<string, CelInput>([
    ["total", 0n], ["prev_total", 0n], ["kinds", 0n], ["seconds", 0n],
    ["start", ""], ["end", ""], ["groups", []], ["summary", "probe"],
  ]) as CelInput,
} as Record<string, CelInput>;

/** Throws a RuleError when the parsed expression cannot work as a rule (or key). */
export function checkParsed(expr: unknown, kind: "rule" | "key"): void {
  const unknown = undeclared(expr);
  if (unknown.length) throw new RuleError(`unknown variable ${unknown.map((n) => `'${n}'`).join(", ")}\n\n${HINT}`);
  if (kind === "rule" && isJudgeCall(expr)) throw new RuleError(`the rule must be true or false, but judge.* yields a number — ${COMPARE}`);
}

/** Dry-runs a planned expression with neutral answers; throws a RuleError on what only evaluation shows. */
export function checkPlanned(run: Planned, kind: "rule" | "key"): void {
  const out = evaluateWith({ answers: null, calls: [], keys: [] }, run, PROBE);
  if (isCelError(out) && /unbound function|no matching overload for 'judge\./.test(out.message)) {
    throw new RuleError(`${out.message}\n\n${HINT}`);
  }
  if (kind === "rule" && !isCelError(out) && typeof out !== "boolean") {
    throw new RuleError(`the rule must be true or false, but it yields ${describe(out)} — ${COMPARE}`);
  }
}

/** Is a runtime error a bug in the rule rather than in the record? */
export function isRuleBug(err: Error): boolean {
  return /unbound function|unresolved attribute/.test(err.message);
}

export function describe(v: unknown): string {
  if (typeof v === "number" || typeof v === "bigint") return `a number (${v})`;
  if (typeof v === "string") return "a string";
  return typeof v;
}

function isJudgeCall(e: any): boolean {
  const call = e?.exprKind?.case === "callExpr" ? e.exprKind.value : undefined;
  const target = call?.target?.exprKind;
  return target?.case === "identExpr" && target.value.name === "judge";
}

/** Names used as variables that are neither declared nor bound by a macro. */
function undeclared(root: unknown): string[] {
  const found = new Set<string>();
  const walk = (e: any, scope: Set<string>): void => {
    if (!e?.exprKind) return;
    const { case: kind, value: v } = e.exprKind;
    switch (kind) {
      case "identExpr":
        if (!scope.has(v.name) && !VARIABLES.has(v.name) && !BUILTIN_IDENTS.has(v.name)) found.add(v.name);
        return;
      case "selectExpr":
        return walk(v.operand, scope);
      case "callExpr":
        // judge.boolean(...) parses as a call on the identifier `judge`.
        if (!(v.target?.exprKind?.case === "identExpr" && v.target.exprKind.value.name === "judge")) walk(v.target, scope);
        for (const a of v.args) walk(a, scope);
        return;
      case "listExpr":
        for (const el of v.elements) walk(el, scope);
        return;
      case "structExpr":
        for (const en of v.entries) {
          if (en.keyKind?.case === "mapKey") walk(en.keyKind.value, scope);
          walk(en.value, scope);
        }
        return;
      case "comprehensionExpr": {
        walk(v.iterRange, scope);
        walk(v.accuInit, scope);
        const inner = new Set([...scope, v.iterVar, v.iterVar2, v.accuVar].filter(Boolean));
        walk(v.loopCondition, inner);
        walk(v.loopStep, inner);
        walk(v.result, inner);
        return;
      }
    }
  };
  walk(root, new Set());
  return [...found];
}
