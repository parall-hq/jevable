// The benchmark's numbers for the site, computed from its result files
// (bench/wake/) with the same arithmetic as bench/wake/report.ts.
import freshResults from "../../../../bench/wake/fresh-results.json";
import firstResults from "../../../../bench/wake/results.json";
import { tally, wakeCosts, type AgentRun, type Results } from "../../../../bench/wake/tally.ts";

const runs = Object.values(import.meta.glob("../../../../bench/wake/agent-runs/*.json", { eager: true, import: "default" })) as AgentRun[];

export const wakes = wakeCosts(runs);
export const freshRun = freshResults as Results;
/** Fresh events, labelled blind: the headline slice. */
export const fresh = tally(freshRun, (e) => e.slice === "fresh", wakes);
/** The first run's held-out samples, before the rules were reworded. */
export const first = tally(firstResults as Results, (e) => e.slice === "holdout", wakes);

export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const times = (x: number) => `${x.toFixed(1)}×`;
/** Share of the events that mattered which a way of watching did not miss. */
export const caught = (missed: number, matter: number) => (matter - missed) / matter;

/** The headline: fewer agent turns than waking on every event, and what was caught. */
export const headline = {
  fewer: times(fresh.total["every event"].turns / fresh.total.jevable.turns),
  caught: pct(caught(fresh.total.jevable.missed, fresh.matter)),
  keywordCaught: pct(caught(fresh.total["keyword alert"].missed, fresh.matter)),
  events: fresh.events,
};
