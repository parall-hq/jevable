// 2. grep wakes it for words: a stencil over the belt lets through what has
// the word (a pun: a needless wake) and turns away what does not
// (real outages worded differently: missed).
import React from "react";
import { G, P, SCENE, b } from "../cues";
import { S } from "../data";
import { C, MONO, amber, red } from "../lib/brand";
import { EASE, bez, clamp01, drift, lerp, pulse, ramp, shake, wobble } from "../lib/anim";
import { At, Cam, Chip, Floor, MINI_MONEY, MiniMeter, Ring, Tag, Words, abs, full, H, W } from "../lib/ui";
import { AGX, AGY, Belt, Blade, BY, GX, SESSION, TW, Ticket, ticketLayout, TSIZE } from "../lib/stage";
import { Session, lightAt, wakeLines } from "../lib/session";
import { usd } from "../story";
import { AX, AY, PROBLEM_LINES, Problem, SH, SW, cost, problemCam } from "./Problem";

const PANEL = { w: 640, h: 380, y: 428 };
const BLADE_TOP = PANEL.y + PANEL.h / 2;
const FS = { reset: 150, api: 196 };
/** The dive ends on the stencil's dot as an orb this big (radius, px); the reveal picks it up there. */
export const ORB = 300;
/** Why the "reset" post was a needless wake (the site calls it a pun). */
const WHY = ["a pun"];
/** Which feed each alert watches, engraved under its command. */
const WATCH = { reset: "on @thsottiaux's posts", api: "on the status pages" };
const LIGHT = lightAt(SESSION.w, SESSION.h);
/** The session's log in this shot: the pun wakes it, it takes a turn, and there is nothing to do. */
const LINES = G.pass.flatMap((at, i) => wakeLines(at + b(0.5), S.grep.reset.cards[i].text, "Not relevant.", "dim"));

/** The stencil: a steel panel with the word cut through it. */
export const Stencil: React.FC<{ word: string; label: string; watch: string; light: number; tone?: "wake" | "wrong"; fs: number; dotLight?: number; dark?: number }> = ({
  word,
  label,
  watch,
  light,
  tone = "wake",
  fs,
  dotLight = 0,
  dark = 0,
}) => {
  const { w, h } = PANEL;
  const id = word;
  // "i" is cut as a dotless ı plus a round hole, so the dot's place is known.
  const chars = word.replace("i", "ı");
  const x0 = w / 2 - (chars.length * 0.6 * fs) / 2;
  const base = h * 0.8;
  const iAt = word.indexOf("i");
  const dot = iAt >= 0 ? { x: x0 + (iAt + 0.5) * 0.6 * fs, y: base - 0.735 * fs, r: 0.075 * fs } : null;
  const glow = tone === "wake" ? amber : red;
  const text = (props: React.SVGProps<SVGTextElement>) => (
    <text x={x0} y={base} fontFamily={MONO} fontWeight={700} fontSize={fs} textAnchor="start" {...props}>
      {chars}
    </text>
  );
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <mask id={`holes-${id}`}>
          <rect width={w} height={h} fill="white" />
          {text({ fill: "black" })}
          {dot && <circle cx={dot.x} cy={dot.y} r={dot.r} fill="black" />}
        </mask>
        <linearGradient id={`steel-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3c3c44" />
          <stop offset="0.45" stopColor="#26262c" />
          <stop offset="0.52" stopColor="#2e2e35" />
          <stop offset="1" stopColor="#18181c" />
        </linearGradient>
        <filter id={`brush-${id}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.003 0.45" numOctaves={2} seed={3} />
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.35 0" />
        </filter>
        <filter id={`bloom-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={16} />
        </filter>
        <radialGradient id={`cavity-${id}`} cx="0.5" cy="0.62" r="0.6">
          <stop offset="0" stopColor={tone === "wake" ? "#ffe0a8" : "#ffc4c4"} />
          <stop offset="0.35" stopColor={tone === "wake" ? C.wake : C.wrong} />
          <stop offset="1" stopColor={tone === "wake" ? "#8a4d0c" : "#7a2323"} />
        </radialGradient>
      </defs>
      {/* what the holes look into: dark, or lit; the shifted fill reads as the cut's inner wall */}
      <rect x={8} y={8} width={w - 16} height={h - 16} rx={14} fill="#1d1d22" />
      {text({ fill: "#040405", transform: "translate(4 5)" })}
      {dot && <circle cx={dot.x + 4} cy={dot.y + 5} r={dot.r} fill="#040405" />}
      <rect x={8} y={8} width={w - 16} height={h - 16} rx={14} fill={`url(#cavity-${id})`} opacity={light} />
      {dot && <circle cx={dot.x} cy={dot.y} r={dot.r * 1.6} fill={C.wake} opacity={dotLight} />}
      <g mask={`url(#holes-${id})`}>
        <rect width={w} height={h} rx={18} fill={`url(#steel-${id})`} />
        <rect width={w} height={h} rx={18} filter={`url(#brush-${id})`} opacity={0.18} />
        <rect x={1} y={1} width={w - 2} height={h - 2} rx={17} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={2} />
        <rect x={4} y={4} width={w - 8} height={h - 8} rx={15} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth={3} />
        {/* going dark around the dot as the camera dives into it */}
        <rect width={w} height={h} fill="#060607" opacity={dark} />
      </g>
      {light > 0.01 && (
        <g opacity={light * 0.85} style={{ mixBlendMode: "screen" }}>
          {text({ fill: glow(1), filter: `url(#bloom-${id})` })}
        </g>
      )}
      {/* the command it runs and the feed it watches, engraved */}
      <g opacity={1 - dark}>
        {[
          { y: 50, s: 27, fill: "#a4a4ae", text: label, weight: 600 },
          { y: 82, s: 20, fill: "#77777f", text: watch, weight: 500 },
        ].map((l) => (
          <React.Fragment key={l.y}>
            <text x={w / 2} y={l.y + 1.5} textAnchor="middle" fontFamily={MONO} fontWeight={l.weight} fontSize={l.s} fill="rgba(0,0,0,0.6)">
              {l.text}
            </text>
            <text x={w / 2} y={l.y} textAnchor="middle" fontFamily={MONO} fontWeight={l.weight} fontSize={l.s} fill={l.fill}>
              {l.text}
            </text>
          </React.Fragment>
        ))}
        <line x1={36} x2={w - 36} y1={100} y2={100} stroke="rgba(0,0,0,0.55)" strokeWidth={2} />
        <line x1={36} x2={w - 36} y1={102} y2={102} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
      </g>
      {[
        [26, 26],
        [w - 26, 26],
        [26, h - 26],
        [w - 26, h - 26],
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={7} fill="#1a1a1e" />
          <circle cx={x - 1} cy={y - 1} r={5} fill="#4a4a52" />
        </g>
      ))}
    </svg>
  );
};

/** Where the stencil's ı dot sits on screen (world coordinates), for the dive into it. */
export const dotWorld = (() => {
  const fs = FS.api;
  const chars = S.grep.api.word;
  const x0 = PANEL.w / 2 - (chars.length * 0.6 * fs) / 2;
  const iAt = chars.indexOf("i");
  return { x: GX - PANEL.w / 2 + x0 + (iAt + 0.5) * 0.6 * fs, y: PANEL.y - PANEL.h / 2 + PANEL.h * 0.8 - 0.735 * fs, r: 0.075 * fs };
})();

type Pass = (typeof S.grep.reset.cards)[number];

const restX = GX - 16 - TW / 2; // a ticket's center when its front is at the blade
const ticketY = (text: string) => BY - 6 - ticketLayout(text).height / 2;

/** A ticket with the word: it lifts into the stencil, the blade opens, the ticket reaches the agent. */
function passTicket(t: number, at: number, ev: Pass, re: RegExp) {
  const L = ticketLayout(ev.text);
  const y = ticketY(ev.text);
  const hit = at - b(0.5);
  const m = re.exec(ev.text)!;
  const inK = ramp(t, at - b(1.5), hit, EASE.out);
  const through = ramp(t, at, at + b(0.5), EASE.in);
  const x = through > 0 ? lerp(restX, AGX, through) : lerp(-TW, restX, inK);
  const markOn = ramp(t, hit - b(0.3), hit);
  const lift = ramp(t, hit, at - b(0.2), EASE.inOut);
  const pos = L.at(m.index, m.index + m[0].length);
  return { L, x, y, m, markOn, lift, pos, through, gone: t > at + b(0.5) };
}

/** Where the missed tickets come to rest, below the belt, while the agent sleeps on. */
const MISSED_REST = [
  { dx: -60, dy: 128, r: -5 },
  { dx: -10, dy: 158, r: 3 },
];

/** A ticket without the word: it stops at the blade and is tipped off the belt. */
function missTicket(t: number, at: number, text: string, i: number) {
  const L = ticketLayout(text);
  const y = ticketY(text);
  const inK = ramp(t, at - b(1), at, EASE.in);
  const bounce = wobble(t, at, 30, 0.08) * -14;
  const fall = ramp(t, at + b(0.1), at + b(0.6), EASE.in);
  const rest = MISSED_REST[i];
  return { L, x: lerp(-TW, restX, inK) + bounce + rest.dx * fall, y: lerp(y, BY + rest.dy, fall) - Math.sin(Math.PI * fall) * 40, r: rest.r * fall, fall, rest };
}

export const Grep: React.FC<{ t: number }> = ({ t }) => {
  const reset = S.grep.reset,
    api = S.grep.api;
  // the plate drops in, and spins from one alert to the other
  const drop = ramp(t, G.slam - b(0.5), G.slam, EASE.in);
  const flip = ramp(t, G.flip, G.flip + b(0.6), EASE.whip);
  const face = flip < 0.5 ? reset : api;
  const fs = flip < 0.5 ? FS.reset : FS.api;
  const passes = G.pass.map((at, i) => ({ at, ev: reset.cards[i], ...passTicket(t, at, reset.cards[i], reset.re) }));
  const misses = G.miss.map((at, i) => ({ at, ev: api.cards[i], ...missTicket(t, at, api.cards[i].text, i) }));
  const holeLight = Math.max(...G.pass.map((at) => ramp(t, at - b(0.25), at - b(0.2)) * (1 - ramp(t, at + b(0.4), at + b(1)))));
  const bladeLift = Math.max(...G.pass.map((at) => ramp(t, at - b(0.2), at - b(0.05), EASE.out) * (1 - ramp(t, at + b(0.35), at + b(0.55), EASE.in))));
  const needless = G.pass.map((at) => at + b(0.5));
  const lit = pulse(t, needless, 0.5);
  const jolt = pulse(t, needless, 0.06);

  // the camera: a slow truck along the belt, a whip on the flip, then the dive into the ı's dot,
  // which ends as an orb ORB px across the middle of the frame (the reveal starts from it)
  const d = drift(t, 6, "g");
  const sh = shake(t, [[G.slam, 22], [G.miss[0], 6], [G.miss[1], 6], [G.flip + b(0.3), 5]], "g");
  const dive = ramp(t, G.dive, SCENE.reveal, (x) => x * x * x);
  const aim = ramp(t, G.dive, G.dive + b(0.5), EASE.inOut);
  const cx = lerp(980 + ramp(t, G.slam, G.dive, EASE.linear) * 60 + d.x + sh.x, dotWorld.x, aim);
  const cy = lerp(545 + d.y + sh.y, dotWorld.y, aim);
  const camS = 1.1 * Math.exp(dive * Math.log(ORB / dotWorld.r / 1.1)) * (1 + ramp(t, G.dive - b(1), G.dive, EASE.in) * 0.06);

  // coming in from scene 1: the heap falls away and the session slides to the end of the belt
  const fall = ramp(t, P.fall[0], P.fall[1], EASE.in);
  const handoff = ramp(t, P.fall[0], G.slam + b(0.25), EASE.inOut);
  const pc = problemCam(t);
  const toWorld = (sx: number, sy: number) => ({ x: (sx - W / 2) / camS + cx, y: (sy - H / 2) / camS + cy });
  const toScreen = (x: number, y: number) => ({ x: (x - cx) * camS + W / 2, y: (y - cy) * camS + H / 2 });
  const from = toWorld((AX - pc.x) * pc.s + W / 2, (AY - pc.y) * pc.s + H / 2);
  const stageIn = ramp(t, P.fall[0], G.slam, EASE.out);
  const paid = needless.filter((a) => t >= a + 0.5).length;

  return (
    <div style={{ ...full, background: C.bg, overflow: "hidden" }}>
      {t < P.fall[1] && (
        <div style={{ ...full, opacity: 1 - ramp(t, P.fall[1] - 0.15, P.fall[1]) }}>
          <Problem t={t} fall={fall} hideAgent />
        </div>
      )}
      <Floor horizon={BY + 20} scroll={t * 140} glowX={AGX} glow={lit * 0.8} opacity={stageIn * (1 - aim)} />
      <Cam x={cx} y={cy} s={camS} r={sh.r * (1 - aim)}>
        <div style={{ ...full, opacity: stageIn }}>
          <Belt scroll={t * 260} glow={lit} />
        </div>
        <div style={{ ...full, opacity: 1 - aim }}>
          <Blade top={BLADE_TOP} dy={-(1 - drop) * 1000} lift={bladeLift} />
        </div>

        {/* tickets that go through ride under the panel, so they pass the blade */}
        {passes.map((p, i) =>
          p.gone || t < p.at - b(1.5) ? null : (
            <At key={i} x={p.x} y={p.y} s={1 - ramp(p.through, 0.75, 1) * 0.8} o={1 - ramp(p.through, 0.85, 1)}>
              <Ticket text={p.ev.text} source={p.ev.source} matters={p.ev.matters} mark={[p.m.index, p.m.index + p.m[0].length]} markOn={p.markOn} lifted={p.lift > 0 ? 1 : 0} state={p.through > 0.3 ? "wrong" : "idle"} />
            </At>
          ),
        )}
        {misses.map((m, i) =>
          t < m.at - b(1) ? null : (
            <React.Fragment key={i}>
              <At x={m.x} y={m.y} r={m.r} o={1 - m.fall * 0.2}>
                <Ticket text={m.ev.text} source={m.ev.source} matters={m.ev.matters} state={m.fall > 0.05 ? "wrong" : "idle"} />
              </At>
              {/* one tag, on the latest ticket to miss */}
              {!(G.miss[i + 1] !== undefined && t >= G.miss[i + 1] + b(0.5)) && (
                <div style={{ ...abs, left: restX + m.rest.dx + TW / 2 + 24, top: BY + m.rest.dy - 22 }}>
                  <Tag t={t} at={m.at + b(0.5)}>{i === 0 ? "Missed · it mattered" : "Missed again"}</Tag>
                </div>
              )}
            </React.Fragment>
          ),
        )}

        <At x={GX} y={PANEL.y - (1 - drop) * 1000} r={sh.r * 3 + wobble(t, G.slam, 7, 0.45) * 2.2 * (1 - aim)}>
          <div style={{ perspective: 1400 }}>
            <div style={{ transform: `rotateY(${flip * 180}deg)`, transformStyle: "preserve-3d" }}>
              <div style={{ transform: flip >= 0.5 ? "rotateY(180deg)" : undefined, filter: "drop-shadow(0 30px 40px rgba(0,0,0,0.7))" }}>
                <Stencil
                  word={face.word}
                  label={face.grep}
                  watch={flip < 0.5 ? WATCH.reset : WATCH.api}
                  light={flip < 0.5 ? holeLight : 0}
                  fs={fs}
                  dotLight={ramp(t, G.dive - b(0.25), G.dive + b(0.25))}
                  dark={ramp(t, G.dive, SCENE.reveal, EASE.in)}
                />
              </div>
            </div>
          </div>
        </At>

        {/* the matched word leaves the ticket and locks into the stencil */}
        {passes.map((p, i) => {
          if (t < p.at - b(0.5) || t > p.at - b(0.15)) return null;
          const fx = p.x - TW / 2 + p.pos.x + p.pos.w / 2,
            fy = p.y - p.L.height / 2 + p.pos.y + p.pos.h / 2;
          const tx = GX,
            ty = PANEL.y - PANEL.h / 2 + PANEL.h * 0.8 - FS.reset * 0.36;
          const k = p.lift;
          return (
            <At key={`w${i}`} x={bez(fx, lerp(fx, tx, 0.3), tx, k)} y={bez(fy, ty - 220, ty, k)} s={lerp(1, FS.reset / TSIZE, k)} o={1 - ramp(k, 0.85, 1)}>
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: TSIZE, color: "#ffd08a", textShadow: `0 0 12px ${amber(0.9)}`, whiteSpace: "nowrap" }}>
                {p.m[0].toLowerCase()}
              </span>
            </At>
          );
        })}

        {/* the same session, carried over from scene 1, at the end of the belt; a fresh log from the slam on */}
        <At x={lerp(from.x, AGX, handoff)} y={lerp(from.y, AGY, handoff)} o={1 - aim}>
          <Session
            t={t}
            w={lerp((SW * pc.s) / camS, SESSION.w, handoff)}
            h={lerp((SH * pc.s) / camS, SESSION.h, handoff)}
            lines={t < G.slam ? PROBLEM_LINES : LINES}
            lit={Math.max(lit, t < G.slam ? 1 - handoff : 0)}
            jolt={jolt}
            sleep={t < G.slam ? 0 : 1 - clamp01(lit * 3)}
          />
        </At>
        {needless.map((at, i) => (
          <Ring key={i} t={t} at={at} x={AGX + LIGHT.x} y={AGY + LIGHT.y} max={220} dur={0.45} width={5} />
        ))}
        {needless.map((at, i) => (
          <At key={`n${i}`} x={AGX} y={AGY - SESSION.h / 2 - 44}>
            <Tag t={t} at={at + b(0.25)} until={G.flip + b(0.25)}>
              Needless wake · {WHY[i]}
            </Tag>
          </At>
        ))}
      </Cam>

      {/* the paid turn, into the meter */}
      <div style={{ opacity: stageIn * (1 - aim) }}>
        <MiniMeter n={paid} money={cost(paid)} kick={pulse(t, needless.map((a) => a + 0.5), 0.1)} />
      </div>
      {needless.map((at, i) => (
        <Chip key={i} t={t} at={at} from={toScreen(AGX + LIGHT.x, AGY + LIGHT.y)} to={MINI_MONEY} text={`+${usd(S.claims.wake)}`} />
      ))}

      <div style={{ ...abs, left: 110, top: 86, opacity: 1 - ramp(t, G.dive, G.dive + b(0.4)) }}>
        <Words t={t} at={G.header} size={78} from="above" words={[{ w: "grep", mono: true }, { w: "wakes" }, { w: "it" }, { w: "for" }, { w: "words.", c: C.wrong }]} />
      </div>
    </div>
  );
};
