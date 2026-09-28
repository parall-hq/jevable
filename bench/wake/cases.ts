// The cases in cases/ as event streams: every labelled sample, in one
// fixed interleaved order (the same hash order the landing page demo uses),
// with what the watcher is for in plain words.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const ROOT = new URL("../../", import.meta.url).pathname;
export const HERE = new URL("./", import.meta.url).pathname;

export interface Watch {
  id: string;
  /** What the watcher reads. */
  source: string;
  /** What should wake the agent. */
  goal: string;
}

export const WATCHES: Watch[] = [
  { id: "tibo", source: "Tibo's (@thsottiaux) posts on X", goal: "an announcement that Codex usage limits were reset (not a teaser, not a pun)" },
  { id: "status", source: "the Claude and OpenAI status pages", goal: "a resolved incident that touched a model, the API or a developer tool" },
  { id: "hn-problems", source: "Hacker News comments", goal: "a comment reporting a problem with Claude Code" },
  { id: "regressions", source: "new issues on anthropics/claude-code", goal: "an issue saying something that used to work is now broken" },
  { id: "releases", source: "releases of our dependencies (vercel/ai, prisma, hono)", goal: "a release that needs code changes on our side or fixes a security vulnerability" },
  { id: "review-asks", source: "PR review comments on vercel/next.js", goal: "a human reviewer asking for a code change" },
];

export type Slice = "tuned" | "holdout" | "fresh";

export interface Event {
  line: string;
  /** Labelled as an event the agent should react to. */
  matters: boolean;
  /** tuned: yes/no.txt, the rule was written on them; holdout: never used to write the rule. */
  slice: Slice;
}

const FILES: [string, boolean, Slice][] = [
  ["yes.txt", true, "tuned"],
  ["no.txt", false, "tuned"],
  ["holdout-yes.txt", true, "holdout"],
  ["holdout-no.txt", false, "holdout"],
];

/** Every labelled event of a case, both slices, interleaved so the stream reads like a real feed. */
export function stream(id: string): Event[] {
  const dir = join(ROOT, "cases", id);
  const events = FILES.flatMap(([file, matters, slice]) =>
    existsSync(join(dir, file))
      ? readFileSync(join(dir, file), "utf8")
          .split("\n")
          .filter((l) => l.trim())
          .map((line) => ({ line, matters, slice }))
      : [],
  );
  return events.sort((a, b) => hash(a.line) - hash(b.line));
}

/**
 * Events fetched after the rules were revised, never used to write any rule,
 * labelled blind (bench/fresh/labels.json); the ones labelled unsure are left out.
 */
export function fresh(id: string): Event[] {
  const file = join(ROOT, "bench", "fresh", `${id}.jsonl`);
  if (!existsSync(file)) return [];
  const labels = JSON.parse(readFileSync(join(ROOT, "bench", "fresh", "labels.json"), "utf8"))[id] as { i: number; label: string }[];
  const lines = readFileSync(file, "utf8").split("\n").filter((l) => l.trim());
  return labels.filter((l) => l.label !== "unsure").map((l) => ({ line: lines[l.i], matters: l.label === "yes", slice: "fresh" as const }));
}

/** A case's rule as it was before the revision measured on the fresh events. */
export function ruleBefore(id: string): string {
  return readFileSync(join(ROOT, "bench", "fresh", "rules-before", `${id}.cel`), "utf8");
}

export function rule(id: string): string {
  return readFileSync(join(ROOT, "cases", id, "rule.cel"), "utf8");
}

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}
