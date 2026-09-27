// Builds src/data/demo.json for the landing page: real Jev answers for the
// labelled samples in cases/, next to what a keyword alert would have done.
// The page itself never calls Jev. Run after changing a case:
//
//   npm run demo-data -w packages/web     (key from TYPESAFE_API_KEY or ~/.jevable/key)

import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Client, Engine, parseRecord, toCel, type Call } from "@jevable/core";

const CASES = new URL("../../../cases/", import.meta.url);
const OUT = new URL("../src/data/demo.json", import.meta.url);

interface Case {
  id: string;
  title: string;
  source: string;
  /** What should wake you, in the words of the person who asked. */
  ask: string;
  /** The alert someone would write first, run over the raw event like grep -iE. */
  grep: string;
  /** The event as the page shows it. */
  show: (r: { line: string; json: any }) => string;
}

const cases: Case[] = [
  {
    id: "tibo",
    title: "Codex limit resets",
    source: "@thsottiaux on X",
    ask: "Tell me when Tibo announces that Codex usage limits were reset.",
    grep: "reset",
    show: (r) => r.line,
  },
  {
    id: "status",
    title: "API incidents",
    source: "Claude and OpenAI status pages",
    ask: "Tell me when a resolved incident touched a model, the API or a developer tool.",
    grep: "\\bapi\\b",
    show: (r) => `${r.json.page.replace(/^status\./, "")} — ${r.json.name}`,
  },
  {
    id: "regressions",
    title: "Regressions",
    source: "new issues on anthropics/claude-code",
    ask: "Wake me when a new issue says something that used to work is broken.",
    grep: "regression|used to work|no longer|stopped working",
    show: (r) => `#${r.json.number} ${r.json.title}`,
  },
];

function apiKey(): string | undefined {
  if (process.env.TYPESAFE_API_KEY) return process.env.TYPESAFE_API_KEY;
  try {
    return readFileSync(join(homedir(), ".jevable", "key"), "utf8").trim();
  } catch {
    return undefined;
  }
}

/** The number the rule compares: a boolean's probability, or the choice option it reads. */
function score(calls: Call[], rule: string): number | undefined {
  const c = calls.at(-1);
  if (!c) return undefined;
  if (c.value !== undefined) return c.value;
  const option = rule.match(/\["([^"]+)"\]\s*[<>]=?/)?.[1];
  return option ? c.options?.[option] : undefined;
}

const engine = new Engine(new Client({ apiKey: apiKey() }));
const out = [];
for (const c of cases) {
  const dir = new URL(`${c.id}/`, CASES);
  const rule = readFileSync(new URL("rule.cel", dir), "utf8");
  const program = engine.compile(rule);
  const grep = new RegExp(c.grep, "i");
  const samples = (["yes", "no"] as const).flatMap((side) =>
    readFileSync(new URL(`${side}.txt`, dir), "utf8")
      .split("\n")
      .filter((l) => l.trim())
      .map((line) => ({ line, want: side === "yes" })),
  );
  // Interleave the two sides so the stream reads like a real feed.
  samples.sort((a, b) => hash(a.line) - hash(b.line));
  const events = [];
  for (const s of samples) {
    const r = parseRecord(s.line);
    const outcome = await program.match({ line: s.line, json: toCel(r.json) });
    if (outcome.error) throw outcome.error;
    events.push({ text: c.show(r), want: s.want, grep: grep.test(s.line), pass: outcome.pass, score: score(outcome.calls, rule) });
  }
  const { show, ...meta } = c;
  out.push({ ...meta, rule: rule.trim(), events });
  console.log(`${c.id}: ${events.length} events, jevable right on ${events.filter((e) => e.pass === e.want).length}, grep on ${events.filter((e) => e.grep === e.want).length}`);
}
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}
