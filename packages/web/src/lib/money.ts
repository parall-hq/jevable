// Money on the page: formatting, and the monthly cost of each way to watch.
// Shared by the server render and the calculator in the browser.

/** $0.000023, $0.50, $4.20, $1,234: enough digits to show a small amount at all. */
export function usd(x: number): string {
  if (x >= 100) return `$${Math.round(x).toLocaleString("en-US")}`;
  if (x >= 0.01) return `$${x.toFixed(2)}`;
  return `$${x.toPrecision(2)}`;
}

/** A calculator input as shown: 1,000 · 1% · $0.10. */
export function showInput(key: string, v: number): string {
  if (key === "events") return v.toLocaleString("en-US");
  if (key === "share") return `${+(v * 100).toPrecision(2)}%`;
  return usd(v);
}

export const turnsADay = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 1 })} agent turns a day`;

/** jevable against waking on every event: "−97%". */
export const saving = (m: ReturnType<typeof monthly>) => `−${Math.floor((1 - m.jevable.cost / m.every.cost) * 100)}%`;

/** A heartbeat every 30 minutes, OpenClaw's default. */
export const CHECKS_A_DAY = 48;

/**
 * A month of watching `events` a day, of which `share` matter, when one agent
 * turn costs `turn` and one Jev question `question`. jevable is charged a
 * question for every event, though plain conditions usually spare most.
 */
export function monthly(events: number, share: number, turn: number, question: number) {
  const days = 30;
  return {
    every: { turns: events, cost: events * turn * days },
    check: { turns: CHECKS_A_DAY, cost: CHECKS_A_DAY * turn * days },
    jevable: { turns: events * share, cost: (events * share * turn + events * question) * days },
  };
}
