// 5. Proof, from bench/wake through its tally.ts. The same 334 events as a
// wall of lines, every one lit because every one woke the agent; Jev's blade
// passes over them and only the 46 that pass stay lit, counted up beside the
// crossed-out 334. Then the stamp, then what mattered and was caught.
import React from "react";
import { M, SCENE, WALL_COLS, b, sweepAt } from "../cues";
import { S } from "../data";
import { pct, times, usd } from "../story";
import { C, MONO, SANS, amber, red } from "../lib/brand";
import { EASE, clamp01, lerp, ramp, shake, sp, wobble } from "../lib/anim";
import { At, DotGrid, Eyebrow, Meter, Ring, Sparks, Words, abs, full, H, W } from "../lib/ui";
import { cost } from "./Problem";
import { ENGINE_CAM, BLADE_TOP } from "./Engine";
import { BY } from "../lib/stage";

const c = S.claims;
const n = S.feed.length;
const ROWS = Math.ceil(n / WALL_COLS);
const WALL = { colW: 262, gap: 26, lineH: 10, y0: 450 };
const wallW = WALL_COLS * WALL.colW + (WALL_COLS - 1) * WALL.gap;
const x0 = (W - wallW) / 2;
const lines = S.feed.map((e, i) => {
  const col = Math.floor(i / ROWS),
    row = i % ROWS;
  return { e, x: x0 + col * (WALL.colW + WALL.gap), y: WALL.y0 + row * WALL.lineH, at: sweepAt(i, n), text: e.text.slice(0, 44) };
});
const passed = lines.filter((l) => l.e.pass).length;
if (passed !== c.jevable.wakes) throw new Error("the lines left lit should be jevable's wakes");
if (usd(cost(passed)) !== usd(c.jevable.usd)) throw new Error("the meter should land on jevable's total");
const keptAt = lines.filter((l) => l.e.pass).map((l) => l.at);
const mattered = S.feed.filter((e) => e.matters);
const DOTS = { x: 430, pitch: 22, r: 9, rows: [470, 640] };
const LEFT = 140;

/** jevable's wakes as the blade passes: every line it keeps lit is one. */
function kept(t: number) {
  const count = keptAt.filter((a) => a <= t).length;
  return { count, money: cost(count) };
}

export const Proof: React.FC<{ t: number }> = ({ t }) => {
  const light = ramp(t, M.light[0], M.light[1], EASE.out);
  const sweep = ramp(t, M.sweep[0], M.sweep[1], EASE.linear);
  const slam = sp(t, M.slam, { damping: 16, stiffness: 320, mass: 0.7 });
  const through = ramp(t, M.caught - b(0.75), M.caught - b(0.1), EASE.in); // flying through the stamp to the next panel
  const collapse = ramp(t, M.out, SCENE.outro, (x) => x * x);
  const sh = shake(t, [[M.slam, 30], [M.slam + 0.1, 8], [M.caught, 6]], "m");
  const w = kept(t);
  const wallDim = ramp(t, M.slam - 0.05, M.slam + 0.25) * 0.65;
  const pulseLit = t > M.riser[0] && t < M.slam ? 0.5 + 0.5 * Math.sin((t - M.riser[0]) * 18) : 0;

  // the blade comes in where scene 4 left it, stretches over the wall and sweeps across
  const bladeIn = ramp(t, M.in, M.sweep[0], EASE.inOut);
  const bladeX = t < M.sweep[0] ? lerp(W / 2, x0 - 16, bladeIn) : lerp(x0 - 16, x0 + wallW + 16, sweep);
  const bladeTop = lerp(H / 2 - ((BY - BLADE_TOP) * ENGINE_CAM.s) / 2, WALL.y0 - 24, bladeIn);
  const bladeBot = lerp(H / 2 + ((BY - BLADE_TOP) * ENGINE_CAM.s) / 2, WALL.y0 + ROWS * WALL.lineH + 24, bladeIn);
  const bladeO = 1 - ramp(t, M.sweep[1], M.sweep[1] + 0.3);

  const dotsK = (i: number) => {
    const a = M.dots[0] + (i / mattered.length) * (M.dots[1] - M.dots[0]);
    return ramp(t, a, a + 0.12, EASE.out);
  };
  const panel = ramp(t, M.caught - b(0.2), M.caught + b(0.3), EASE.out);
  const fine = ramp(t, M.fine, M.fine + b(1));
  const fade = 1 - ramp(collapse, 0, 0.6);
  const hud = 1 - through;

  return (
    <div style={{ ...full, background: C.bg, overflow: "hidden" }}>
      <DotGrid opacity={0.45 * fade} x={-t * 10} y={-t * 5} />

      {/* the wall, and the stamp over it: the camera flies through both into the next panel */}
      <div
        style={{
          ...full,
          transformOrigin: "960px 560px",
          transform: `translate(${sh.x}px, ${sh.y}px) scale(${(1 + ramp(t, M.sweep[0], M.slam, EASE.in) * 0.09) * (1 + through * through * 2.2)})`,
          opacity: 1 - through,
        }}
      >
        <div style={{ ...full, opacity: 1 - wallDim, filter: wallDim > 0.05 ? `blur(${wallDim * 3}px)` : undefined }}>
          {lines.map((l, i) => {
            const on = clamp01((light * 1.4 - (l.y - WALL.y0) / (ROWS * WALL.lineH) * 0.4) / 1);
            if (on <= 0) return null;
            const off = l.e.pass ? 0 : ramp(t, l.at, l.at + 0.15, EASE.out);
            const kept = l.e.pass && t >= l.at ? 1 : 0;
            const missed = l.e.matters && !l.e.pass;
            return (
              <div
                key={i}
                style={{
                  ...abs,
                  left: l.x,
                  top: l.y + off * 3,
                  width: WALL.colW,
                  height: WALL.lineH - 1.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  opacity: on * (1 - off * 0.6 - ramp(t, M.sweep[1], M.sweep[1] + b(1.5)) * off * 0.25),
                  background: amber((0.13 + kept * 0.32 + kept * pulseLit * 0.2) * (1 - off)),
                  boxShadow: kept ? `0 0 14px ${amber(0.5)}` : undefined,
                  fontWeight: kept ? 600 : 400,
                  borderRadius: 2,
                  fontFamily: MONO,
                  fontSize: 8.4,
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  color: off > 0.5 ? "#44444c" : kept ? "#fff0d2" : "#f0c27a",
                  textShadow: kept ? `0 0 6px ${amber(0.8)}` : undefined,
                }}
              >
                <span style={{ width: 4, height: 4, borderRadius: "50%", flex: "none", marginLeft: 2, background: missed && off > 0.5 ? C.wrong : l.e.matters ? C.wake : "transparent" }} />
                {l.text}
              </div>
            );
          })}
        </div>
        {/* Jev's blade */}
        {bladeO > 0 && t >= M.in && (
          <>
            <div style={{ ...abs, left: bladeX - 70, top: bladeTop - 20, width: 140, height: bladeBot - bladeTop + 40, background: `radial-gradient(ellipse 70px 50% at 50% 50%, ${amber(0.45 * bladeO)}, transparent 70%)` }} />
            <div
              style={{
                ...abs,
                left: bladeX - 8.5,
                top: bladeTop,
                width: 17,
                height: bladeBot - bladeTop,
                borderRadius: 8,
                opacity: bladeO,
                background: "linear-gradient(90deg, #ffb547, #fff1d6 45%, #fff1d6 55%, #ffb547)",
                boxShadow: `0 0 20px ${amber(1)}, 0 0 70px ${amber(0.7)}, 0 0 160px ${amber(0.35)}`,
              }}
            />
          </>
        )}

        {t >= M.slam - 0.02 && (
          <At x={W / 2} y={560} s={lerp(2.4, 1, slam) * (1 + wobble(t, M.slam + 0.1, 22, 0.1) * 0.04)} o={clamp01(slam * 5)} z={5}>
            <div style={{ textAlign: "center", whiteSpace: "nowrap" }}>
              <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 280, letterSpacing: "-0.015em", lineHeight: 0.9, color: C.wake, textShadow: `0 0 80px ${amber(0.5)}, 0 10px 0 #3a2508` }}>{times(c.fewer)}</div>
              <div style={{ marginTop: 18, fontFamily: SANS, fontWeight: 600, fontSize: 64, letterSpacing: "-0.03em", color: C.fg, textShadow: "0 4px 30px rgba(0,0,0,0.9)" }}>fewer agent wakes</div>
            </div>
          </At>
        )}
        <Ring t={t} at={M.slam} x={W / 2} y={520} max={400} dur={0.35} width={6} />
        <Sparks t={t} at={M.slam} x={W / 2} y={520} n={24} r0={330} r1={480} dur={0.4} width={6} />
      </div>

      {/* the header, and scene 1's meter: what it was, crossed out, and jevable's count running up */}
      <div style={{ ...abs, left: 110, top: 70, opacity: hud * fade }}>
        <Eyebrow o={ramp(t, M.in, M.in + b(0.5))}>
          {c.events} fresh events · {c.sources} live sources · labelled blind
        </Eyebrow>
        <div style={{ marginTop: 14 }}>
          <Words t={t} at={M.in} size={64} color={C.dim} from="above" words={[{ w: "The" }, { w: "same" }, { w: String(c.events) }, { w: "events," }]} />
          <Words t={t} at={M.in + b(0.5)} size={64} from="above" words={[{ w: "through" }, { w: "jevable.", c: C.wake, mono: true }]} />
        </div>
      </div>
      <div style={{ opacity: hud * fade }}>
        <Meter n={w.count} money={w.money} perWake={usd(c.wake)} was={["every event", `${c.every.wakes} · ${usd(c.every.usd)}`]} wasStrike={ramp(t, M.sweep[1], M.sweep[1] + 0.3)} kick={t >= M.sweep[1] ? Math.max(0, wobble(t, M.sweep[1], 22, 0.12)) : 0} />
      </div>

      {/* what mattered, caught */}
      {panel > 0 && (
        <div style={{ ...full, opacity: panel * fade, transform: `scale(${0.88 + 0.12 * panel})`, transformOrigin: "960px 560px" }}>
          <div style={{ ...abs, left: LEFT, top: 220 }}>
            <Words t={t} at={M.caught - b(0.4)} size={64} words={[{ w: "Of" }, { w: "the" }, { w: String(c.matter) }, { w: "that" }, { w: "mattered," }, { w: "caught:", c: C.wake }]} />
          </div>
          {[
            { y: DOTS.rows[0], label: <span style={{ fontFamily: MONO, fontWeight: 600, color: C.fg }}>jevable</span>, hit: mattered.map((e) => e.pass), share: c.caught, color: C.wake },
            {
              y: DOTS.rows[1],
              label: (
                <span style={{ color: C.dim }}>
                  <span style={{ fontFamily: MONO }}>grep</span> <span style={{ fontSize: 24 }}>keyword alert</span>
                </span>
              ),
              hit: mattered.map((e) => e.grep),
              share: c.keywordCaught,
              color: C.dim,
            },
          ].map((row, ri) => (
            <React.Fragment key={ri}>
              <div style={{ ...abs, left: LEFT, top: row.y - 22, fontFamily: SANS, fontWeight: 500, fontSize: 36, whiteSpace: "nowrap" }}>{row.label}</div>
              {row.hit.map((h, i) => {
                const k = dotsK(i);
                return (
                  <div
                    key={i}
                    style={{
                      ...abs,
                      left: DOTS.x + i * DOTS.pitch - DOTS.r,
                      top: row.y - DOTS.r,
                      width: 2 * DOTS.r,
                      height: 2 * DOTS.r,
                      borderRadius: "50%",
                      boxSizing: "border-box",
                      background: h ? row.color : "transparent",
                      border: h ? "none" : `2.5px solid ${red(0.9)}`,
                      boxShadow: h && ri === 0 ? `0 0 10px ${amber(0.7)}` : undefined,
                      transform: `scale(${k})`,
                      opacity: k * (ri === 0 ? 1 - collapse : 1),
                    }}
                  />
                );
              })}
              <div
                style={{
                  ...abs,
                  left: DOTS.x + mattered.length * DOTS.pitch + 30,
                  top: row.y - 60,
                  fontFamily: SANS,
                  fontWeight: 700,
                  fontSize: 110,
                  lineHeight: 1,
                  letterSpacing: "-0.05em",
                  color: row.color,
                  textShadow: ri === 0 ? `0 0 40px ${amber(0.45)}` : undefined,
                  opacity: ramp(t, M.dots[1] - b(0.25), M.dots[1]),
                  transform: `scale(${1 + wobble(t, M.dots[1], 20, 0.1) * 0.08})`,
                }}
              >
                {pct(row.share)}
              </div>
            </React.Fragment>
          ))}
          <div style={{ ...abs, left: DOTS.x, top: DOTS.rows[1] + 56, display: "flex", gap: 30, fontFamily: SANS, fontSize: 24, color: C.dim, opacity: ramp(t, M.dots[1], M.dots[1] + b(0.5)) }}>
            <span>
              <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: "50%", background: C.dim, marginRight: 10 }} />
              caught
            </span>
            <span>
              <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: "50%", border: `2.5px solid ${C.wrong}`, boxSizing: "border-box", marginRight: 10 }} />
              missed
            </span>
          </div>
          {/* one line of small print; the rest of the disclosure is in the README */}
          <div style={{ ...abs, left: LEFT, top: 860, width: W - 2 * LEFT, fontFamily: SANS, fontSize: 28, color: "#a0a0a8", opacity: fine, whiteSpace: "nowrap" }}>
            {c.events} fresh events, labelled blind · jevable still missed{" "}
            <span style={{ color: C.fg }}>
              {c.jevable.missed} of {c.matter}
            </span>{" "}
            — all on <span style={{ color: C.fg, fontFamily: MONO }}>jevable.sh/bench</span>
          </div>
        </div>
      )}

      {/* everything that mattered and was caught flies home into one dot */}
      {collapse > 0 &&
        mattered.map((e, i) =>
          e.pass ? (
            <At key={i} x={lerp(DOTS.x + i * DOTS.pitch, W / 2, collapse)} y={lerp(DOTS.rows[0], H / 2, collapse)} s={1 + collapse * 0.6}>
              <div style={{ width: 2 * DOTS.r, height: 2 * DOTS.r, borderRadius: "50%", background: C.wake, boxShadow: `0 0 ${10 + 30 * collapse}px ${amber(0.8)}` }} />
            </At>
          ) : null,
        )}
    </div>
  );
};
