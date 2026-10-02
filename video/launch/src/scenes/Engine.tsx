// 4. One question per line: the pipe is now the gate, a blade of amber light.
// Jev reads each ticket, a needle shows its answer, and only a yes reaches
// the agent: a Claude Code session, which acts. The pun that fooled grep comes back first.
import React from "react";
import { E, SCENE, b } from "../cues";
import { READS, S } from "../data";
import { about, usd } from "../story";
import { C, MONO, SANS, amber, white } from "../lib/brand";
import { EASE, clamp01, drift, lerp, pulse, rand, ramp, shake, sp } from "../lib/anim";
import { At, Cam, Chip, Eyebrow, Floor, MINI_MONEY, MiniMeter, Ring, abs, full, H, W } from "../lib/ui";
import { AGX, AGY, Belt, BY, GX, SESSION, Ticket, ticketLayout, TW } from "../lib/stage";
import { Session, lightAt, wakeLines } from "../lib/session";
import { cost } from "./Problem";

const LIGHT = lightAt(SESSION.w, SESSION.h);
/** What the session does when a real reset reaches it: it acts. */
const REPLIES = ["Codex limits were reset. Letting you know.", "Another reset. Letting you know."];
const LINES = READS.filter((r) => r.pass).flatMap((r, i) => wakeLines(r.leave, r.text, REPLIES[i % REPLIES.length], "fg"));

export const BLADE_TOP = 580;
const G = { x: GX, y: 480, r: 230 }; // the gauge's pivot and radius
/** The camera once it has pulled out of the pipe; the proof picks the blade up where this leaves it. */
export const ENGINE_CAM = { s: 1.2, bladeY: (BLADE_TOP + BY) / 2 };
/** The first post is the one grep woke the agent for. */
const CALLBACK = ["the pun"];

/** A damped spring's step response: 0 → 1 with a little overshoot. */
const step = (dt: number) => (dt <= 0 ? 0 : 1 - Math.exp(-0.42 * 34 * dt) * (Math.cos(31 * dt) + ((0.42 * 34) / 31) * Math.sin(31 * dt)));

/** The needle: each ticket pushes it to Jev's score, and it holds there until the next ticket comes in. */
function needle(t: number) {
  let v = 0;
  READS.forEach((r, i) => (v += r.score * (step(t - r.scan) - step(t - (READS[i + 1]?.scan ?? E.out)))));
  return Math.max(-0.02, Math.min(1.03, v));
}

const angle = (v: number) => Math.PI * (1 + v); // 0 on the left, 1 on the right

const Gauge: React.FC<{ v: number; threshold: number; glow: number }> = ({ v, threshold, glow }) => {
  const { r } = G;
  const pt = (val: number, rad: number) => ({ x: r + 30 + Math.cos(angle(val)) * rad, y: r + 30 + Math.sin(angle(val)) * rad });
  const arc = (a: number, z: number, rad: number) => {
    const p = pt(a, rad),
      q = pt(z, rad);
    return `M ${p.x} ${p.y} A ${rad} ${rad} 0 0 1 ${q.x} ${q.y}`;
  };
  const tip = pt(v, r - 34);
  const size = 2 * r + 60;
  return (
    <svg width={size} height={r + 90} viewBox={`0 0 ${size} ${r + 90}`} style={{ overflow: "visible" }}>
      <defs>
        <radialGradient id="face" cx="0.5" cy="1" r="1">
          <stop offset="0" stopColor="#1a1a1e" />
          <stop offset="1" stopColor="#0c0c0e" />
        </radialGradient>
      </defs>
      <path d={`${arc(0, 1, r + 22)} L ${pt(1, 0).x} ${pt(1, 0).y + 40} L ${pt(0, 0).x} ${pt(0, 0).y + 40} Z`} fill="url(#face)" stroke={C.lineStrong} strokeWidth={2} />
      <path d={arc(0, threshold, r)} fill="none" stroke="#2e2e35" strokeWidth={14} />
      <path d={arc(threshold, 1, r)} fill="none" stroke={C.wake} strokeWidth={14} opacity={0.55 + 0.45 * glow} style={{ filter: `drop-shadow(0 0 ${8 + 20 * glow}px ${amber(0.8)})` }} />
      {Array.from({ length: 21 }, (_, i) => {
        const val = i / 20;
        const major = i % 5 === 0;
        const a = pt(val, r - 20),
          z = pt(val, r - (major ? 44 : 32));
        return <line key={i} x1={a.x} y1={a.y} x2={z.x} y2={z.y} stroke={val >= threshold ? amber(0.8) : white(0.35)} strokeWidth={major ? 3 : 1.5} />;
      })}
      {[
        [0, "0"],
        [0.5, "0.5"],
        [threshold, String(threshold)],
        [1, "1"],
      ].map(([val, label]) => {
        const p = pt(val as number, r - 78);
        return (
          <text key={label} x={p.x} y={p.y + 8} textAnchor="middle" fontFamily={MONO} fontSize={24} fontWeight={500} fill={(val as number) >= threshold ? C.wake : C.faint}>
            {label}
          </text>
        );
      })}
      <line x1={r + 30} y1={r + 30} x2={tip.x} y2={tip.y} stroke={C.fg} strokeWidth={6} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 10px ${white(0.5)})` }} />
      <circle cx={r + 30} cy={r + 30} r={18} fill="#2a2a30" stroke={C.lineStrong} strokeWidth={2} />
      <circle cx={r + 30} cy={r + 30} r={7} fill={C.fg} />
    </svg>
  );
};

export const Engine: React.FC<{ t: number }> = ({ t }) => {
  const v = needle(t);
  const wakes = READS.filter((r) => r.pass).map((r) => r.leave);
  const lit = pulse(t, wakes, 0.35);
  const jolt = pulse(t, wakes, 0.06);
  const reading = READS.some((r) => t >= r.scan && t < r.read);
  const zoneGlow = clamp01((v - S.threshold) * 12);

  // the camera: out of the pipe, a slow truck, then back onto the blade, which carries into the proof
  const open = ramp(t, E.open, E.open + b(1.25), EASE.inOut);
  const out = ramp(t, E.out, SCENE.proof, EASE.inOut);
  const d = drift(t, 5, "e");
  const sh = shake(t, [[E.open, 10], ...wakes.map((w) => [w, 6] as [number, number])], "e");
  const camX = lerp(lerp(GX, 1060, open) + ramp(t, E.open, E.out, EASE.linear) * 40 + (d.x + sh.x) * (1 - out), GX, out);
  const camY = lerp(lerp(ENGINE_CAM.bladeY, 525, open) + (d.y + sh.y) * (1 - out), ENGINE_CAM.bladeY, out);
  const camS = lerp(3.2, ENGINE_CAM.s, open);
  const rest = 1 - ramp(t, E.out, E.out + b(0.6)); // everything but the blade leaves with the scene

  const qIn = sp(t, E.question, { damping: 16, stiffness: 170 });
  const paid = wakes.filter((w) => t >= w + 0.5).length;
  const toScreen = (x: number, y: number) => ({ x: (x - camX) * camS + W / 2, y: (y - camY) * camS + H / 2 });
  const facts = sp(t, E.facts, { damping: 16 });

  // only Jev's exact answer is ever shown: the latest one read, until the next card comes in
  const i = READS.findLastIndex((x) => t >= x.read);
  const shown = i >= 0 && !(READS[i + 1] && t >= READS[i + 1].scan) ? READS[i] : undefined;
  const pop = shown ? sp(t, shown.read, { damping: 11, stiffness: 320, mass: 0.5 }) : 0;

  return (
    <div style={{ ...full, background: C.bg, overflow: "hidden" }}>
      <div style={{ ...full, opacity: rest }}>
        <Floor horizon={BY + 20} scroll={t * 140} glowX={AGX} glow={lit * 0.9} />
      </div>
      <Cam x={camX} y={camY} s={camS} r={sh.r * rest} ry={lerp(0, -3, open) * rest}>
        <div style={{ ...full, opacity: rest }}>
          <Belt scroll={t * 260} glow={lit} />
        </div>
        {/* Jev: the pipe's "|" as a blade of light */}
        <div style={{ ...abs, left: GX - 60, top: BLADE_TOP - 40, width: 120, height: BY - BLADE_TOP + 60, background: `radial-gradient(ellipse 60px 50% at 50% 50%, ${amber(0.35 + (reading ? 0.35 : 0))}, transparent 70%)` }} />
        <div
          style={{
            ...abs,
            left: GX - 7,
            top: BLADE_TOP,
            width: 14,
            height: BY - BLADE_TOP,
            borderRadius: 7,
            background: "linear-gradient(90deg, #ffb547, #fff1d6 45%, #fff1d6 55%, #ffb547)",
            boxShadow: `0 0 18px ${amber(1)}, 0 0 60px ${amber(0.7)}, 0 0 140px ${amber(0.35)}`,
          }}
        />
        <At x={G.x} y={G.y - G.r / 2 + 16} o={open * rest}>
          <Gauge v={v} threshold={S.threshold} glow={zoneGlow} />
        </At>
        <At x={G.x} y={BLADE_TOP - 6} o={open * rest}>
          <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 22, letterSpacing: "0.2em", color: C.bg, background: C.wake, padding: "6px 12px 6px 16px", borderRadius: 6, boxShadow: `0 0 20px ${amber(0.6)}` }}>JEV</div>
        </At>

        {READS.map((r, n) => {
          if (t < r.enter || t > r.leave + 0.5) return null;
          const L = ticketLayout(r.text);
          const y0 = BY - 6 - L.height / 2;
          const inK = ramp(t, r.enter, r.scan, EASE.out);
          const go = ramp(t, r.read, r.leave, EASE.in);
          const scan = ramp(t, r.scan, r.read, EASE.inOut);
          let x = lerp(-TW / 2 - 40, GX, inK),
            y = y0,
            rot = 0,
            s = 1,
            o = 1;
          if (r.pass) {
            // along the belt and into the agent
            x = lerp(GX, AGX, go);
            s = 1 - ramp(go, 0.7, 1) * 0.85;
            o = 1 - ramp(go, 0.92, 1);
          } else {
            const f = ramp(t, r.read, r.leave + 0.4, EASE.in);
            x -= f * 40;
            y += f * f * 520;
            rot = -f * 30 * (0.6 + rand(n, 3) * 0.8);
            o = 1 - ramp(f, 0.55, 0.95);
          }
          if (o <= 0.01) return null;
          const state = t >= r.read ? (r.pass ? "wake" : "dim") : "idle";
          return (
            <React.Fragment key={n}>
              {r.pass && go > 0 && go < 1 && (
                // the streak it leaves on its way to the agent
                <div style={{ ...abs, left: GX, top: y - 6, width: Math.max(0, x - GX), height: 12, borderRadius: 6, background: `linear-gradient(90deg, transparent, ${amber(0.7)})`, filter: "blur(3px)", opacity: rest }} />
              )}
              <At x={x} y={y} r={rot} s={s} o={o * rest} z={2}>
                <Ticket text={r.text} source={r.source} matters={r.matters} state={state} scan={t >= r.scan ? scan : undefined} read={t >= r.read ? 1 : 0} />
              </At>
              {n < CALLBACK.length && t < r.read + b(0.5) && (
                <At x={x - TW / 2 + 90} y={y - L.height / 2 - 28} o={ramp(t, r.enter + 0.1, r.enter + 0.25) * (1 - ramp(t, r.read, r.read + b(0.4))) * rest}>
                  <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 22, letterSpacing: "0.12em", textTransform: "uppercase", color: C.fg, background: "rgba(10,10,11,0.85)", border: `1.5px solid ${C.lineStrong}`, borderRadius: 6, padding: "5px 10px", whiteSpace: "nowrap" }}>
                    {CALLBACK[n]}, again
                  </div>
                </At>
              )}
            </React.Fragment>
          );
        })}

        <At x={AGX} y={AGY} o={rest}>
          <Session t={t} w={SESSION.w} h={SESSION.h} lines={LINES} lit={lit} jolt={jolt} sleep={1 - clamp01(lit * 2.5)} />
        </At>
        {wakes.map((w, n) => (
          <Ring key={n} t={t} at={w} x={AGX + LIGHT.x} y={AGY + LIGHT.y} max={220} dur={0.45} width={5} />
        ))}

        {/* Jev's answer */}
        <div style={{ ...abs, left: GX + 300, top: 255, opacity: open * rest }}>
          <Eyebrow>Jev · chance of yes</Eyebrow>
          <div
            style={{
              fontFamily: MONO,
              fontWeight: 600,
              fontSize: 120,
              lineHeight: 1.05,
              letterSpacing: "-0.04em",
              color: shown?.pass ? C.wake : C.dim,
              opacity: shown ? 1 : 0.25,
              transform: `scale(${0.85 + 0.15 * (shown ? pop : 1)})`,
              transformOrigin: "0% 50%",
              textShadow: shown?.pass ? `0 0 40px ${amber(0.6)}` : undefined,
            }}
          >
            {shown ? shown.score.toFixed(2) : "–.––"}
          </div>
          <div style={{ marginTop: 14, fontFamily: SANS, fontSize: 26, color: C.dim, whiteSpace: "nowrap" }}>Jev: TypeSafe's classification model</div>
          <div style={{ marginTop: 10, opacity: facts, transform: `translateY(${(1 - facts) * 20}px)`, fontFamily: MONO, fontSize: 28, color: C.dim, whiteSpace: "nowrap" }}>
            <span style={{ color: C.fg }}>~0.3 s</span> · <span style={{ color: C.fg }}>{about(S.perQuestion)}</span> a line
          </div>
        </div>
      </Cam>

      {/* the question every line is asked: it lands whole */}
      <div style={{ ...abs, left: 110, top: 84, opacity: open * rest }}>
        <Eyebrow>One question, every line</Eyebrow>
        <div style={{ marginTop: 14, fontFamily: MONO, fontSize: 33, color: C.wake, whiteSpace: "nowrap", textShadow: `0 0 30px ${amber(0.3)}`, opacity: clamp01(qIn * 2), transform: `translateY(${(1 - qIn) * 24}px)` }}>
          "{S.question}"
        </div>
      </div>
      {/* the paid turns, into the meter */}
      <div style={{ opacity: open * rest }}>
        <MiniMeter n={paid} money={cost(paid)} kick={pulse(t, wakes.map((w) => w + 0.5), 0.1)} />
      </div>
      {wakes.map((w, n) => (
        <Chip key={n} t={t} at={w} from={toScreen(AGX + LIGHT.x, AGY + LIGHT.y)} to={MINI_MONEY} text={`+${usd(S.claims.wake)}`} />
      ))}
    </div>
  );
};
