// The repo's files, loaded by the bundler, turned into the story once.
import fresh from "../../../bench/wake/fresh-results.json";
import keywords from "../../../bench/wake/keywords.json";
import demo from "../../../packages/web/src/data/demo.json";
import type { AgentRun, Results } from "../../../bench/wake/tally.ts";
import { arrivals, readerTimes } from "./cues";
import { story, type DemoCase } from "./story";

declare const require: { context(dir: string, deep: boolean, re: RegExp): { keys(): string[]; (key: string): unknown } };
const runsDir = require.context("../../../bench/wake/agent-runs", false, /\.json$/);
const runs = runsDir
  .keys()
  .filter((k) => k.startsWith("./"))
  .map((k) => runsDir(k) as AgentRun);

export const S = story({ fresh: fresh as unknown as Results, runs, demo: demo as DemoCase[], keywords });

/** When each fresh event reaches the agent in scene 1. */
export const WAKES = arrivals(S.feed.length);
/** Each card's time at Jev's reader in scene 4. */
export const READS = readerTimes().map((r, i) => ({ ...r, ...S.reads[i] }));
