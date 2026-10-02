// 3. Reveal: the stencil's dot, now an orb, closes into jevable's dot; the
// name rises out of it, the tagline, then the pipe is typed with the question
// the reader will ask — and we dive into its "|".
import React from "react";
import { R, SCENE, b, command } from "../cues";
import { S } from "../data";
import { C, MONO, MONO_EM, amber } from "../lib/brand";
import { EASE, clamp01, drift, lerp, ramp, shake, sp, wobble } from "../lib/anim";
import { Cam, DotGrid, Words, Wordmark, abs, full, markLayout, H, W } from "../lib/ui";
import { ORB } from "./Grep";

const F = 170;
const WY = 430;
const CMD = { size: 36, y: 760, pad: 36 };
const cw = MONO_EM * CMD.size;
const lh = CMD.size * 1.55;
// the pipe ends the first line; the second is indented, as a shell continues a pipe
const TEXT = command(S.question);
const SPLIT = TEXT.indexOf("|") + 1;
const LINES = [
  { text: TEXT.slice(0, SPLIT), start: 0, indent: 2 },
  { text: TEXT.slice(SPLIT + 1), start: SPLIT + 1, indent: 4 },
];
const QUOTE = TEXT.indexOf('"');
/** How far the camera dives into the "|": enough that its stroke is as wide as scene 4's blade when that shot opens. */
const DIVE = 13;
const cmdW = Math.max(...LINES.map((l) => (l.indent + l.text.length) * cw)) + CMD.pad * 2;
const cmdLeft = W / 2 - cmdW / 2;
const lineY = (i: number) => CMD.y + (i - 0.5) * lh;
export const pipeAt = { x: cmdLeft + CMD.pad + (LINES[0].indent + SPLIT - 0.5) * cw, y: lineY(0) };

/** How the command reads: the pipe and the question in amber, as on the site. */
const colorOf = (i: number) => (i === SPLIT - 1 || i >= QUOTE ? C.wake : C.fg);

/** The wordmark's group (lifted above the command once it is typed). */
const group = (t: number) => {
  const lift = ramp(t, R.lift, R.lift + b(1), EASE.inOut);
  return { lift, y: -lift * 170, s: 1 - lift * 0.2 };
};
const push = (t: number) => 1 + ramp(t, R.dot, R.dive, EASE.linear) * 0.035;

/** Where jevable's dot is on screen while the camera only pushes in (before the dive): the key art's dot. */
export function revealDot(t: number) {
  const mark = markLayout(F);
  const g = group(t);
  const d = drift(t, 5, "r");
  const x = W / 2 + mark.dot.x * g.s,
    y = WY + g.y + mark.dot.y * g.s;
  const s = push(t);
  return { x: (x - W / 2 - d.x) * s + W / 2, y: (y - H / 2 - d.y) * s + H / 2, r: mark.dot.r * g.s * s };
}

export const Reveal: React.FC<{ t: number }> = ({ t }) => {
  const mark = markLayout(F);
  const { lift, y: groupY, s: groupS } = group(t);
  const dotX = W / 2 + mark.dot.x * groupS,
    dotY = WY + groupY + mark.dot.y * groupS;

  // the orb from the stencil's dot closes into jevable's dot
  const shrink = ramp(t, SCENE.reveal, R.dot, EASE.in);
  const landed = t >= R.dot;
  const dotPop = landed ? 1 + wobble(t, R.dot, 24, 0.12) * 0.35 : 1;
  const letterK = (i: number) => sp(t, R.letters + b(0.12) * (6 - i), { damping: 13, stiffness: 190, mass: 0.6 });
  const promptK = sp(t, R.letters + b(1), { damping: 18 });

  // typed up to the question; the question lands whole
  const typed = t >= R.question ? TEXT.length : Math.floor(clamp01((t - R.type[0]) / (R.type[1] - R.type[0])) * QUOTE + 1e-6);
  const landing = sp(t, R.question, { damping: 14, stiffness: 240, mass: 0.6 });
  const boxIn = sp(t, R.type[0] - b(0.5), { damping: 18, stiffness: 160 });
  const entered = t >= R.enter;
  const pipeGlow = entered ? 1 + wobble(t, R.enter, 18, 0.2) * 0.6 : 0;

  // the camera: a slow push, then a whip into the pipe
  const d = drift(t, 5, "r");
  const sh = shake(t, [[R.dot, 14], [R.enter, 4]], "r");
  const dive = ramp(t, R.dive, SCENE.engine, (x) => x * x * x);
  // after the landing (which must stay square to the screen), the camera drifts into a slight three-quarter view
  const tilt = ramp(t, R.dot + b(0.5), R.type[1], EASE.inOut);
  const aim = ramp(t, R.dive, R.dive + b(0.4), EASE.inOut);
  const camX = lerp(W / 2 + d.x, pipeAt.x, aim);
  const camY = lerp(H / 2 + d.y, pipeAt.y, aim);
  const camS = push(t) * Math.exp(dive * Math.log(DIVE));
  const others = 1 - ramp(t, R.dive + b(0.2), SCENE.engine - b(0.1));
  const cursor = Math.min(typed, TEXT.length - 1);
  const cursorLine = cursor >= LINES[1].start ? 1 : 0;

  return (
    <div style={{ ...full, background: C.bg, overflow: "hidden" }}>
      <DotGrid opacity={0.8 * others} x={-t * 12} y={-t * 6} />
      <div style={{ ...full, background: `radial-gradient(ellipse 900px 520px at ${dotX}px ${dotY}px, ${amber(0.16 * clamp01(shrink * 2))}, transparent 70%)`, opacity: others }} />
      <Cam x={camX + sh.x} y={camY + sh.y} s={camS} r={sh.r} rx={2.5 * tilt * (1 - aim)} ry={-4 * tilt * (1 - aim)}>
        <div style={{ ...abs, left: W / 2, top: WY + groupY, transform: `scale(${groupS})`, opacity: others }}>
          {landed && <Wordmark size={F} letters={letterK} prompt={promptK} dot={dotPop} sheen={ramp(t, R.tagline - b(0.5), R.tagline + b(1), EASE.inOut)} />}
        </div>
        <div style={{ ...abs, left: 0, width: W, top: WY + groupY + 150 - lift * 30, textAlign: "center", opacity: others, transform: `scale(${1 - lift * 0.08})`, transformOrigin: "960px 0" }}>
          <div style={{ display: "inline-block" }}>
            <Words t={t} at={R.tagline} size={76} step={b(0.25)} words={[{ w: "Make" }, { w: "your" }, { w: "monitor" }, { w: "smart.", c: C.wake, glow: true }]} />
          </div>
        </div>

        {/* the command, typed */}
        <div
          style={{
            ...abs,
            left: cmdLeft,
            top: CMD.y - lh - 26,
            width: cmdW,
            height: 2 * lh + 52,
            borderRadius: 18,
            background: "linear-gradient(180deg, #0f0f12, #080809)",
            border: `1.5px solid ${C.lineStrong}`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 30px 60px rgba(0,0,0,0.6)`,
            opacity: boxIn * others,
            transform: `translateY(${(1 - boxIn) * 40}px)`,
          }}
        />
        {LINES.map((line, li) => (
          <div
            key={li}
            style={{
              ...abs,
              left: cmdLeft + CMD.pad,
              top: lineY(li) - CMD.size / 2,
              fontFamily: MONO,
              fontSize: CMD.size,
              lineHeight: `${CMD.size}px`,
              whiteSpace: "pre",
              opacity: boxIn,
              transform: `translateY(${(1 - boxIn) * 40}px)`,
            }}
          >
            <span style={{ color: C.faint, opacity: others }}>{li === 0 ? "$ " : " ".repeat(line.indent)}</span>
            {line.text.split("").map((ch, j) => {
              const i = line.start + j;
              const pipe = i === SPLIT - 1;
              return (
                <span
                  key={j}
                  style={{
                    color: colorOf(i),
                    opacity: i < typed ? (pipe ? 1 : others) * (i >= QUOTE ? clamp01(landing * 2) : 1) : 0,
                    display: "inline-block",
                    transform: i >= QUOTE && landing < 1 ? `translateY(${(1 - landing) * -18}px)` : undefined,
                    fontWeight: pipe ? 700 : 400,
                    textShadow: pipe && pipeGlow ? `0 0 ${8 * pipeGlow}px ${amber(1)}, 0 0 ${24 * pipeGlow}px ${amber(0.8)}` : undefined,
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </div>
        ))}
        {t >= R.type[0] - b(0.5) && (
          <div
            style={{
              ...abs,
              left: cmdLeft + CMD.pad + (LINES[cursorLine].indent + (typed >= TEXT.length ? LINES[1].text.length : cursor - LINES[cursorLine].start)) * cw,
              top: lineY(cursorLine) - CMD.size * 0.55,
              width: cw * 0.9,
              height: CMD.size * 1.1,
              background: C.wake,
              opacity: (typed < TEXT.length || Math.floor(t * 3.4) % 2 === 0 ? 0.9 : 0) * others * boxIn,
              boxShadow: `0 0 16px ${amber(0.6)}`,
            }}
          />
        )}
      </Cam>

      {/* the orb from the stencil's dot, closing into jevable's dot */}
      {!landed && (
        <svg style={full} width={W} height={H}>
          <defs>
            <radialGradient id="orb" cx="0.4" cy="0.35" r="0.7">
              <stop offset="0" stopColor="#fff1d6" />
              <stop offset="0.45" stopColor={C.wake} />
              <stop offset="1" stopColor="#d9831f" />
            </radialGradient>
          </defs>
          <circle cx={lerp(W / 2, dotX, shrink)} cy={lerp(H / 2, dotY, shrink)} r={lerp(ORB, mark.dot.r, shrink)} fill={C.wake} />
        </svg>
      )}
    </div>
  );
};
