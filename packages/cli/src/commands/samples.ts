// `jev test`: run a rule on samples that should and should not pass, show
// every answer, the samples that came out wrong, and per question the
// thresholds that separate the two sides.

import { existsSync, readFileSync, statSync } from "node:fs";
import { clip, parseRecord, toCel, type Call, type Engine } from "@jevable/core";

export interface Sample {
  text: string;
  expect: boolean;
  pass?: boolean;
  calls?: Call[];
  error?: Error;
}

/** A sample value is a file with one sample per line, or the text itself. */
export function expandSamples(values: string[], expect: boolean): Sample[] {
  return values.flatMap((v) => {
    if (existsSync(v) && statSync(v).isFile()) {
      return readFileSync(v, "utf8")
        .split("\n")
        .filter((l) => l.trim())
        .map((text) => ({ text, expect }));
    }
    return [{ text: v, expect }];
  });
}

/** Judges every sample (8 at a time) and returns the report and whether all came out as expected. */
export async function runSamples(engine: Engine, rule: string, samples: Sample[]): Promise<{ report: string; ok: boolean }> {
  const program = engine.compile(rule, "rule");
  const queue = [...samples];
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      for (let s = queue.shift(); s; s = queue.shift()) {
        const { json } = parseRecord(s.text);
        Object.assign(s, await program.match({ line: s.text, json: toCel(json) }));
      }
    }),
  );
  if (engine.fatal) throw engine.fatal;

  const rows = samples.map((s) => {
    const right = !s.error && s.pass === s.expect;
    return [right ? "ok" : "WRONG", s.expect ? "yes" : "no", answers(s), clip(s.text.split(/\s+/).join(" "), 70)];
  });
  const widths = [0, 1, 2].map((i) => Math.max(...rows.map((r) => r[i].length)));
  const wrong = rows.filter((r) => r[0] === "WRONG").length;
  const lines = rows.map((r) => r.map((c, i) => (i < 3 ? c.padEnd(widths[i]) : c)).join("  "));
  lines.push("", `${samples.length - wrong} of ${samples.length} as expected.`, ...separation(samples, rule));
  return { report: lines.join("\n") + "\n", ok: wrong === 0 };
}

function answers(s: Sample): string {
  if (s.error) return `error: ${clip(s.error.message, 60)}`;
  if (!s.calls?.length) return "(no judge call)";
  return s.calls
    .map((c) => {
      if (c.value !== undefined) return c.value.toFixed(2);
      const [best, p] = Object.entries(c.options ?? {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? ["?", 0];
      return `${best} ${p.toFixed(2)}`;
    })
    .join(" · ");
}

/**
 * Per question — and for choice, per option the rule reads — the range of
 * answers on each side and the thresholds that split them.
 */
function separation(samples: Sample[], rule: string): string[] {
  const byQuestion = new Map<string, Map<string, { yes: number[]; no: number[] }>>();
  const add = (q: string, option: string, v: number, expect: boolean) => {
    if (!byQuestion.has(q)) byQuestion.set(q, new Map());
    const byOption = byQuestion.get(q)!;
    if (!byOption.has(option)) byOption.set(option, { yes: [], no: [] });
    byOption.get(option)![expect ? "yes" : "no"].push(v);
  };
  for (const s of samples) {
    for (const c of s.calls ?? []) {
      const q = `judge.${c.fn} ${JSON.stringify(c.question)}`;
      if (c.value !== undefined) add(q, "", c.value, s.expect);
      for (const [o, v] of Object.entries(c.options ?? {})) add(q, o, v, s.expect);
    }
  }
  const out: string[] = [];
  for (const [q, byOption] of byQuestion) {
    const read = [...byOption.keys()].filter((o) => o && readsOption(rule, o));
    const options = (read.length ? read : [...byOption.keys()]).sort();
    const lines = options.flatMap((o) => {
      const { yes, no } = byOption.get(o)!;
      if (!yes.length || !no.length) return [];
      const [yLo, yHi, nLo, nHi] = [Math.min(...yes), Math.max(...yes), Math.min(...no), Math.max(...no)].map((v) => v.toFixed(2));
      const verdict =
        Math.max(...no) < Math.min(...yes)
          ? `any threshold above ${nHi} and up to ${yLo} separates them (use >=)`
          : `not separable: a no sample scores ${nHi}, a yes sample ${yLo} — reword the question or add criteria`;
      return [`  ${o ? `[${JSON.stringify(o)}] ` : ""}yes ${yLo}–${yHi} · no ${nLo}–${nHi} → ${verdict}`];
    });
    if (lines.length) out.push("", q, ...lines);
  }
  return out;
}

/** Does the rule read this choice option: ["opt"], ['opt'] or .opt? */
function readsOption(rule: string, option: string): boolean {
  const o = option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\[\\s*["']${o}["']\\s*\\]|\\.${o}\\b`).test(rule);
}
