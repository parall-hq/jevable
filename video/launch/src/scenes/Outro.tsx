// 6. One prompt, any agent: the caught dots become jevable's dot; the prompt
// that sets it up; the agents it wakes; where to find it.
import React from "react";
import { O, RUNTIMES, SCENE, SETUP, b } from "../cues";
import { C, MONO, MONO_EM, SANS, amber } from "../lib/brand";
import { EASE, clamp01, drift, lerp, ramp, sp, wobble } from "../lib/anim";
import { Cam, DotGrid, Words, Wordmark, abs, full, markLayout } from "../lib/ui";

const F = 100;
const MARK_Y = 190;
const PROMPT = { size: 42, y: 560 };
const TICK = SETUP.indexOf("`");
const TICK_END = SETUP.lastIndexOf("`");

export const Outro: React.FC<{ t: number }> = ({ t }) => {
  const mark = markLayout(F);
  const settle = ramp(t, SCENE.outro, O.dot + b(0.75), EASE.inOut);
  const dotX = lerp(960, 960 + mark.dot.x, settle),
    dotY = lerp(540, MARK_Y + mark.dot.y, settle);
  const letters = (i: number) => sp(t, O.dot + b(0.25) + b(0.08) * i, { damping: 14, stiffness: 200, mass: 0.6 });
  const typed = Math.floor(clamp01((t - O.prompt[0]) / (O.prompt[1] - O.prompt[0])) * SETUP.length + 1e-6);
  const pill = sp(t, O.prompt[0] - b(0.25), { damping: 18, stiffness: 150 });
  const cw = MONO_EM * PROMPT.size;
  const pillW = SETUP.length * cw + 80;
  const url = sp(t, O.url, { damping: 16 });
  const d = drift(t, 4, "o");
  const push = 1 + ramp(t, SCENE.outro, SCENE.end, EASE.linear) * 0.035;

  return (
    <div style={{ ...full, background: C.bg, overflow: "hidden" }}>
      <DotGrid opacity={0.7 * ramp(t, O.dot, O.dot + b(1))} x={t * 8} y={t * 4} />
      <div style={{ ...full, background: `radial-gradient(ellipse 1100px 600px at ${dotX}px ${dotY}px, ${amber(0.13)}, transparent 70%)` }} />
      <Cam x={960 + d.x} y={560 + d.y} s={push}>
        <div style={{ ...abs, left: 960, top: MARK_Y }}>{settle >= 1 ? <Wordmark size={F} letters={letters} prompt={sp(t, O.dot + b(0.9))} dot={1 + wobble(t, O.url, 20, 0.15) * 0.3} /> : null}</div>
        {settle < 1 && (
          <div style={{ ...abs, left: dotX - mark.dot.r * 1.6, top: dotY - mark.dot.r * 1.6, width: mark.dot.r * 3.2, height: mark.dot.r * 3.2, borderRadius: "50%", background: C.wake, boxShadow: `0 0 40px ${amber(0.9)}, 0 0 120px ${amber(0.5)}`, transform: `scale(${lerp(1, 0.625, settle)})` }} />
        )}
        <div style={{ ...abs, left: 0, top: 300, width: 1920, textAlign: "center" }}>
          <div style={{ display: "inline-block" }}>
            <Words t={t} at={O.header} size={92} step={b(0.25)} words={[{ w: "One" }, { w: "prompt." }, { w: "Any", c: C.wake }, { w: "agent.", c: C.wake, glow: true }]} />
          </div>
        </div>
        {/* the prompt to paste */}
        <div
          style={{
            ...abs,
            left: 960 - pillW / 2,
            top: PROMPT.y - 58,
            width: pillW,
            height: 116,
            borderRadius: 16,
            background: "linear-gradient(180deg, #141417, #0d0d0f)",
            border: `1.5px solid ${C.lineStrong}`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 30px 70px rgba(0,0,0,0.6), 0 0 0 ${6 * wobble(t, O.prompt[1], 16, 0.2)}px ${amber(0.15)}`,
            opacity: pill,
            transform: `translateY(${(1 - pill) * 30}px)`,
          }}
        />
        <div style={{ ...abs, left: 960 - pillW / 2 + 40, top: PROMPT.y - PROMPT.size / 2, fontFamily: MONO, fontSize: PROMPT.size, lineHeight: `${PROMPT.size}px`, whiteSpace: "pre", opacity: pill }}>
          {SETUP.split("").map((ch, i) => (
            <span key={i} style={{ color: i >= TICK && i <= TICK_END ? C.wake : C.fg, opacity: i < typed ? 1 : 0 }}>
              {ch}
            </span>
          ))}
        </div>
        {/* any agent: each one's lamp lights on its beat */}
        <div style={{ ...abs, left: 0, top: 730, width: 1920, display: "flex", justifyContent: "center", gap: 60 }}>
          {RUNTIMES.map((name, i) => {
            const k = sp(t, O.names[i] - b(0.2), { damping: 14, stiffness: 220 });
            const on = t >= O.names[i];
            const flash = on ? Math.exp(-(t - O.names[i]) / 0.25) : 0;
            return (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 16, opacity: k, transform: `translateY(${(1 - k) * 26}px)`, fontFamily: SANS, fontWeight: 500, fontSize: 44, letterSpacing: "-0.02em", color: on ? C.fg : C.dim, whiteSpace: "nowrap" }}>
                <span style={{ width: 16, height: 16, borderRadius: "50%", background: on ? C.wake : "#2a2a30", boxShadow: on ? `0 0 ${10 + 30 * flash}px ${amber(0.9)}` : undefined, transform: `scale(${1 + flash * 0.6})` }} />
                {name}
              </div>
            );
          })}
        </div>
        <div style={{ ...abs, left: 0, top: 900, width: 1920, textAlign: "center", opacity: url, transform: `translateY(${(1 - url) * 20}px)`, whiteSpace: "nowrap" }}>
          <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 44, color: C.fg }}>jevable.sh</span>
          <span style={{ fontFamily: SANS, fontSize: 32, color: C.faint, margin: "0 22px" }}>·</span>
          <span style={{ fontFamily: SANS, fontSize: 32, color: C.dim }}>by Parall</span>
        </div>
      </Cam>
    </div>
  );
};
