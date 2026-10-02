// 1. Your agent's monitor wakes it for every line: the 334 fresh benchmark
// events fly at a Claude Code session; each one is a Monitor event, a new
// turn, and money on the meter. Too many to take in, they pile up around it.
import React from "react";
import { P, SLOW, b } from "../cues";
import { S, WAKES } from "../data";
import { usd } from "../story";
import { C } from "../lib/brand";
import { EASE, bez, clamp01, drift, lerp, pulse, rand, ramp, shake, sp, wobble } from "../lib/anim";
import { At, Cam, Card, Chip, Floor, METER_MONEY, Meter, Ring, Words, abs, cardWidth, full, H, W } from "../lib/ui";
import { Session, lightAt, wakeLines, type Line } from "../lib/session";

export const AX = 1400,
  AY = 590;
export const SW = 600,
  SH = 360;
const LIGHT = lightAt(SW, SH);

/** Every event the session is woken by: a Monitor line, and a turn for the ones you can follow. */
export const PROBLEM_LINES: Line[] = S.feed.flatMap((e, i) => (i < SLOW ? wakeLines(WAKES[i], e.text) : [{ at: WAKES[i], kind: "event" as const, text: e.text }]));

const cards = S.feed.map((ev, i) => {
  const early = i < SLOW;
  const depth = early ? 0.45 + 0.25 * rand(i, 1) : rand(i, 2);
  const travel = early ? 1.35 : lerp(0.95, 0.5, (i - SLOW) / (S.feed.length - SLOW));
  // the ones you can read get lanes of their own; the flood stays below the headline and the meter
  const laneY = early ? AY + [-150, 170, -40, 230, -220, 80, -110, 200, 10, 130, -190][i % 11] : 400 + rand(i, 4) * (H - 460);
  const text = ev.text.length > 58 ? ev.text.slice(0, 56).trimEnd() + "…" : ev.text;
  // too many to take in: flood cards bounce off the session into a heap around it
  const j = (i - SLOW) / (S.feed.length - SLOW);
  const a = Math.PI * (0.5 + 1.0 * rand(i, 5)) + (rand(i, 6) < 0.2 ? Math.PI : 0);
  const heap = { x: AX + Math.cos(a) * (330 + 430 * Math.sqrt(j)) * (0.8 + 0.3 * rand(i, 9)), y: Math.max(380, AY + Math.sin(a) * (200 + 260 * Math.sqrt(j))), r: (rand(i, 10) - 0.5) * 70 };
  return { ev, text, depth, travel, laneY, at: WAKES[i], w: cardWidth(text, 24), early, heap };
});

/** Money after n wakes, to the cent, as the benchmark prices a wake. */
export const cost = (n: number) => Math.round(n * S.claims.wake * 100) / 100;

/** Wakes so far: each new count rolls in, except in the flood, where the digits just change. */
function wakesAt(t: number) {
  let i = 0;
  while (i < WAKES.length && WAKES[i] <= t) i++;
  if (i === 0) return { n: 0, money: 0 };
  const flood = i > 1 && WAKES[i - 1] - WAKES[i - 2] < 0.15;
  const frac = flood ? 1 : clamp01((t - WAKES[i - 1]) / 0.09);
  return { n: i - 1 + frac, money: lerp(cost(i - 1), cost(i), frac) };
}

/** The camera: close on the waiting session, pulling back as the stream thickens; a jolt on the freeze. */
export function problemCam(t: number) {
  const k = ramp(t, P.pullBack[0], P.pullBack[1], EASE.inOut);
  const flood = ramp(t, P.flood[0], P.freeze, EASE.in);
  const d = drift(t, 8, "p");
  const sh = shake(t, [[P.flood[0] + 0.3, 3], [P.flood[0] + 0.8, 6], [P.freeze - 0.3, 9], [P.freeze, 30]], "p");
  const push = ramp(t, P.freeze, P.freeze + 0.18, EASE.out) * 0.06;
  return {
    x: lerp(AX - 60, 1000, k) + d.x + sh.x,
    y: lerp(AY - 150, 560, k) + d.y + sh.y,
    s: lerp(1.5, 1, k) * (1 + push) * (1 + flood * 0.03),
    r: sh.r + flood * -0.6,
  };
}

/** Where the session's status light is on screen: the key art's dot drops into it before the cold open. */
export function lightOnScreen(t: number) {
  const c = problemCam(t);
  return { x: (AX + LIGHT.x - c.x) * c.s + W / 2, y: (AY + LIGHT.y - c.y) * c.s + H / 2, r: 7 * c.s };
}

export const Problem: React.FC<{ t: number; fall?: number; hideAgent?: boolean }> = ({ t: tIn, fall = 0, hideAgent }) => {
  const frozen = tIn >= P.freeze;
  const t = frozen ? P.freeze : tIn;
  const hits = WAKES.filter((a) => a <= t);
  const lit = pulse(t, hits, 0.3);
  const jolt = frozen ? wobble(tIn, P.freeze, 30, 0.1) * 0.8 : pulse(t, hits, 0.05);
  const cam = problemCam(tIn);
  const w = wakesAt(tIn);
  // on the freeze the heap slams in around the session
  const slamIn = ramp(tIn, P.freeze, P.freeze + 0.1, EASE.out) * 0.12;
  const meterIn = sp(tIn, WAKES[0] - 0.15);
  const kick = pulse(t, hits.slice(0, SLOW).map((a) => a + 0.5), 0.08) * 0.6 + (frozen ? Math.max(0, wobble(tIn, P.freeze, 26, 0.14)) * 2.2 : 0);
  const hud = fall > 0 ? 1 - ramp(fall, 0, 0.12) : 1;
  const toScreen = (x: number, y: number) => ({ x: (x - cam.x) * cam.s + W / 2, y: (y - cam.y) * cam.s + H / 2 });

  const card = (c: (typeof cards)[number], i: number) => {
    const k = (t - (c.at - c.travel)) / c.travel;
    if (k < 0 || (c.early && k > 1)) return null;
    const e = 0.5 * Math.min(k, 1) + 0.5 * Math.min(k, 1) ** 2;
    const x0 = -300 - c.w / 2,
      y0 = c.laneY;
    let x = bez(x0, AX - 620, AX - SW / 2 + 40, e);
    let y = bez(y0, lerp(y0, AY, 0.25), AY + 40, e);
    let s = lerp(0.6, 1.3, c.depth);
    let r = 0;
    let o = clamp01(k * 10) * lerp(0.45, 1, c.depth);
    let state: "wake" | "idle" | "dim" = "idle";
    if (c.early) {
      // into the session's log
      const into = ramp(k, 0.75, 1, EASE.in);
      x = lerp(x, AX - 80, into);
      y = lerp(y, AY + 40, into);
      s *= 1 - into * 0.9;
      o *= 1 - into * 0.7;
      if (into > 0.2) state = "wake";
    } else {
      // hit, then bounce into the heap
      const h = ramp(k, 1, 1.45, EASE.out);
      x = lerp(lerp(x, c.heap.x, h), AX, slamIn);
      y = lerp(lerp(y, c.heap.y, h) - Math.sin(Math.PI * h) * 90, AY, slamIn);
      s = lerp(s, 0.62, h);
      r = c.heap.r * h;
      o = lerp(o, 0.5, h);
      state = k > 0.9 && k < 1.35 ? "wake" : k >= 1.35 ? "dim" : "idle";
    }
    const speed = c.early ? 0 : Math.sin(Math.PI * clamp01(k)) * (k < 1 ? 1 : 0);
    const blur = (c.depth > 0.82 ? (c.depth - 0.82) * 30 : c.depth < 0.18 ? (0.18 - c.depth) * 12 : 0) + speed * 1.2;
    const g = fall * fall;
    return (
      <At key={i} x={x} y={y + g * (900 + rand(i, 7) * 700)} s={s} sx={1 + speed * 0.25} r={r + g * (rand(i, 8) - 0.5) * 120} o={o * (1 - g)} blur={blur}>
        <Card text={c.text} size={24} matters={c.ev.matters} state={state} />
      </At>
    );
  };
  const order = cards.map((c, i) => ({ c, i })).sort((a, z) => a.c.depth - z.c.depth);
  const entering = (c: (typeof cards)[number]) => c.early && t - (c.at - c.travel) > c.travel * 0.75;
  const light = toScreen(AX + LIGHT.x, AY + LIGHT.y);

  return (
    <div style={{ ...full, background: C.bg, overflow: "hidden" }}>
      <Floor horizon={700} scroll={t * 60} glowX={AX} glow={lit} opacity={1 - fall} />
      <Cam x={cam.x} y={cam.y} s={cam.s} r={cam.r}>
        {order.filter(({ c }) => !entering(c)).map(({ c, i }) => card(c, i))}
        {!hideAgent && (
          <At x={AX} y={AY}>
            <Session t={tIn} w={SW} h={SH} lines={PROBLEM_LINES.filter((l) => l.at <= t)} lit={frozen ? 1 : lit} jolt={jolt} sleep={tIn < WAKES[0] ? 1 : 0} />
          </At>
        )}
        {order.filter(({ c }) => entering(c)).map(({ c, i }) => card(c, i))}
        {hits.slice(0, SLOW).map((a, i) => (
          <Ring key={i} t={t} at={a} x={AX + LIGHT.x} y={AY + LIGHT.y} max={Math.min(150, 80 + i * 7)} dur={0.35} width={3} />
        ))}
      </Cam>

      {/* a soft shade behind the headline and the meter, so the flood never runs through the words */}
      <div style={{ ...full, opacity: hud, background: "linear-gradient(180deg, rgba(10,10,11,0.92) 0%, rgba(10,10,11,0.75) 22%, transparent 40%)" }} />
      {/* +$0.12 for each wake you can follow, from the session into the meter */}
      {!frozen && hits.slice(0, SLOW).map((a, i) => <Chip key={i} t={t} at={a} from={light} to={METER_MONEY} text={`+${usd(S.claims.wake)}`} />)}

      <div style={{ ...abs, left: 110, top: 80, opacity: hud }}>
        <Words t={tIn} at={P.header} size={70} color={C.dim} words={[{ w: "Your" }, { w: "agent's" }, { w: "monitor" }]} />
        <Words t={tIn} at={P.header + b(0.5)} size={70} words={[{ w: "wakes", c: C.wake, glow: true }, { w: "it" }, { w: "for" }, { w: "every" }, { w: "line." }]} />
      </div>
      <div style={{ opacity: meterIn * hud }}>
        <Meter n={w.n} money={w.money} perWake={usd(S.claims.wake)} kick={kick} alarm={frozen} />
      </div>
    </div>
  );
};
