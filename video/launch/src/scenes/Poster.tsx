// Key art: the README cover (Poster, 1920×1080) and link previews (Og, 1200×630).
// The agent lit by the one line that mattered, the rest dropping away; the
// name, the tagline, the pipe, and the measured number.
import React from "react";
import { S } from "../data";
import { times } from "../story";
import { C, MONO, SANS, amber } from "../lib/brand";
import { lerp, rand } from "../lib/anim";
import { At, Card, DotGrid, Floor, Grain, Vignette, Wordmark, abs, full } from "../lib/ui";
import { Session, wakeLines } from "../lib/session";

const c = S.claims;
/** The hero example on jevable.sh (packages/web/src/pages/index.astro). */
const COMMAND = 'tail -F app.log | jevable "Does this report that a dependency is down?"';
// real events from the benchmark: the ones jevable let through light up
const quiet = S.feed.filter((e) => !e.pass).slice(0, 14);
const woke = S.feed.filter((e) => e.pass && e.matters).sort((a, z) => a.text.trim().length - z.text.trim().length)[0];

/** The agent, lit by the one line that got through; the others fall away below the belt of light. */
const Scene: React.FC<{ ax: number; ay: number; size: number; minX: number }> = ({ ax, ay, size, minX }) => (
  <>
    {quiet.map((e, i) => {
      const k = i / (quiet.length - 1);
      const x = lerp(minX + 60, ax - size * 1.1, rand(i, 2));
      const drop = Math.pow(1 - (x - minX) / (ax - minX), 0.8);
      const y = ay + size * 0.55 + drop * 60 + k * 260 * (0.4 + rand(i, 3));
      const text = e.text.length > 30 ? e.text.slice(0, 28).trimEnd() + "…" : e.text;
      return (
        <At key={i} x={x} y={y} s={0.5 + rand(i, 4) * 0.3} r={(rand(i, 6) - 0.3) * 22} o={0.18 + 0.28 * rand(i, 7)} blur={rand(i, 8) > 0.65 ? 2.5 : 0}>
          <Card text={text} size={22} state="dim" />
        </At>
      );
    })}
    <div style={{ ...abs, left: ax - size * 0.78 - 30, top: ay - size * 0.3, transform: "translate(-100%, -50%)" }}>
      <Card text={woke.text.trim()} size={26} state="wake" />
    </div>
    <At x={ax} y={ay}>
      <Session t={10} w={size * 1.56} h={size} lit={1} lines={[...wakeLines(1, woke.text.trim(), "Worth a look. Letting you know.")]} />
    </At>
  </>
);

export const Poster: React.FC = () => (
  <div style={{ ...full, background: C.bg, overflow: "hidden" }}>
    <DotGrid opacity={0.7} />
    <Floor horizon={760} glowX={1560} glow={0.9} />
    <Scene ax={1560} ay={560} size={290} minX={1040} />
    <div style={{ ...abs, left: 150, top: 150 }}>
      <div style={{ position: "relative", left: 250, top: 40 }}>
        <Wordmark size={84} />
      </div>
      <div style={{ marginTop: 110, fontFamily: SANS, fontWeight: 600, fontSize: 116, lineHeight: 0.98, letterSpacing: "-0.045em", color: C.fg }}>
        Make your
        <br />
        monitor <span style={{ color: C.wake, textShadow: `0 0 60px ${amber(0.45)}` }}>smart.</span>
      </div>
      <div style={{ marginTop: 56, display: "inline-block", fontFamily: MONO, fontSize: 25, padding: "18px 24px", borderRadius: 14, background: "#0b0b0d", border: `1.5px solid ${C.line}`, whiteSpace: "pre", color: C.fg }}>
        {COMMAND.slice(0, COMMAND.indexOf("|"))}
        <span style={{ color: C.wake, fontWeight: 700 }}>|</span>
        {COMMAND.slice(COMMAND.indexOf("|") + 1, COMMAND.indexOf('"'))}
        <span style={{ color: C.wake }}>{COMMAND.slice(COMMAND.indexOf('"'))}</span>
      </div>
      <div style={{ marginTop: 46, display: "flex", alignItems: "baseline", gap: 18, fontFamily: SANS, whiteSpace: "nowrap" }}>
        <span style={{ fontWeight: 700, fontSize: 64, letterSpacing: "-0.04em", color: C.wake }}>{times(c.fewer)}</span>
        <span style={{ fontWeight: 500, fontSize: 30, color: C.dim }}>fewer agent wakes, on {c.events} real events</span>
      </div>
    </div>
    <Vignette strength={0.5} />
    <Grain frame={7} opacity={0.05} />
  </div>
);

export const Og: React.FC = () => (
  <div style={{ width: 1200, height: 630, position: "relative", background: C.bg, overflow: "hidden" }}>
    <div style={{ ...abs, width: 1920, height: 1080, transform: "scale(0.625)", transformOrigin: "0 0" }}>
      <DotGrid opacity={0.7} />
      <Floor horizon={780} glowX={1520} glow={0.9} />
      <Scene ax={1500} ay={560} size={320} minX={1040} />
      <div style={{ ...abs, left: 150, top: 190 }}>
        <div style={{ position: "relative", left: 300, top: 50 }}>
          <Wordmark size={100} />
        </div>
        <div style={{ marginTop: 140, fontFamily: SANS, fontWeight: 600, fontSize: 138, lineHeight: 0.98, letterSpacing: "-0.045em", color: C.fg }}>
          Make your
          <br />
          monitor <span style={{ color: C.wake, textShadow: `0 0 60px ${amber(0.45)}` }}>smart.</span>
        </div>
        <div style={{ marginTop: 60, display: "flex", alignItems: "baseline", gap: 20, fontFamily: SANS, whiteSpace: "nowrap" }}>
          <span style={{ fontWeight: 700, fontSize: 84, letterSpacing: "-0.04em", color: C.wake }}>{times(c.fewer)}</span>
          <span style={{ fontWeight: 500, fontSize: 40, color: C.dim }}>fewer agent wakes</span>
        </div>
      </div>
      <Vignette strength={0.5} />
    </div>
  </div>
);
