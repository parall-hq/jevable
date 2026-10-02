import React from "react";
import { C, MONO, MONO_EM, SANS, amber, red, white } from "./brand";
import { EASE, clamp01, lerp, rand, ramp, sp } from "./anim";

export const W = 1920;
export const H = 1080;
export const abs: React.CSSProperties = { position: "absolute", left: 0, top: 0 };
export const full: React.CSSProperties = { ...abs, width: W, height: H };

/** Places a child centered on (x, y). */
export const At: React.FC<{
  x: number;
  y: number;
  s?: number;
  sx?: number;
  sy?: number;
  r?: number;
  o?: number;
  z?: number;
  blur?: number;
  origin?: string;
  children: React.ReactNode;
}> = ({ x, y, s = 1, sx = 1, sy = 1, r = 0, o = 1, z, blur, origin, children }) => (
  <div
    style={{
      ...abs,
      transform: `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${r}deg) scale(${s * sx}, ${s * sy})`,
      transformOrigin: origin,
      opacity: o,
      zIndex: z,
      filter: blur && blur > 0.2 ? `blur(${blur}px)` : undefined,
    }}
  >
    {children}
  </div>
);

/** A camera: everything inside moves as the world, around (cx, cy) at scale s. */
export const Cam: React.FC<{ x?: number; y?: number; s?: number; r?: number; rx?: number; ry?: number; children: React.ReactNode }> = ({
  x = W / 2,
  y = H / 2,
  s = 1,
  r = 0,
  rx = 0,
  ry = 0,
  children,
}) => (
  <div style={{ ...full, perspective: 2000, perspectiveOrigin: "50% 50%" }}>
    <div
      style={{
        ...full,
        transformOrigin: `${x}px ${y}px`,
        transform: `translate(${W / 2 - x}px, ${H / 2 - y}px) rotateX(${rx}deg) rotateY(${ry}deg) rotate(${r}deg) scale(${s})`,
        transformStyle: "preserve-3d",
      }}
    >
      {children}
    </div>
  </div>
);

export function lerpColor(a: string, b: string, k: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], clamp01(k)))).join(",")})`;
}

// ---------- an event: one line, on a card like the site's ticker ----------
export type CardState = "idle" | "wake" | "wrong" | "dim";

export const cardWidth = (text: string, size: number, source?: string) =>
  (text.length + (source ? source.length + 3 : 0)) * MONO_EM * size + size * 2.3;

export const Card: React.FC<{
  text: string;
  source?: string;
  size?: number;
  state?: CardState;
  /** Mark the keyword's match in the text. */
  mark?: RegExp;
  markOn?: number;
  /** The event mattered (amber dot) even when it did not wake anything. */
  matters?: boolean;
  /** How much of the card Jev's reader has passed over, 0..1. */
  scan?: number;
}> = ({ text, source, size = 26, state = "idle", mark, markOn = 0, matters, scan }) => {
  const border = { idle: C.line, dim: C.line, wake: amber(0.55), wrong: red(0.6) }[state];
  const bg = { idle: "rgba(17,17,19,0.94)", dim: "rgba(14,14,16,0.9)", wake: "rgba(40,30,14,0.95)", wrong: "rgba(40,18,18,0.95)" }[state];
  const color = { idle: C.dim, dim: C.faint, wake: C.fg, wrong: C.fg }[state];
  const dot = state === "wake" || matters ? C.wake : state === "wrong" ? C.wrong : C.lineStrong;
  const m = mark ? mark.exec(text) : null;
  const parts = m ? [text.slice(0, m.index), text.slice(m.index, m.index + m[0].length), text.slice(m.index + m[0].length)] : [text];
  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: size * 0.5,
        padding: `${size * 0.52}px ${size * 0.85}px`,
        borderRadius: 999,
        border: `1.5px solid ${border}`,
        background: bg,
        boxShadow:
          state === "wake"
            ? `0 0 ${size * 1.4}px ${amber(0.35)}, 0 ${size * 0.4}px ${size}px rgba(0,0,0,0.5)`
            : state === "wrong"
              ? `0 0 ${size * 1.2}px ${red(0.3)}, 0 ${size * 0.4}px ${size}px rgba(0,0,0,0.5)`
              : `0 ${size * 0.4}px ${size}px rgba(0,0,0,0.55)`,
        fontFamily: MONO,
        fontSize: size,
        lineHeight: 1,
        color,
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          width: size * 0.34,
          height: size * 0.34,
          borderRadius: "50%",
          background: dot,
          boxShadow: dot === C.lineStrong ? undefined : `0 0 ${size * 0.5}px ${dot}`,
          flex: "none",
        }}
      />
      {source && <span style={{ color: C.faint, fontSize: size * 0.8 }}>{source}</span>}
      <span>
        {parts.length === 3 ? (
          <>
            {parts[0]}
            <span
              style={{
                color: lerpColor(color.startsWith("#") ? color : C.dim, "#ffd08a", markOn),
                background: amber(0.22 * markOn),
                boxShadow: `0 0 0 ${size * 0.12}px ${amber(0.22 * markOn)}, 0 0 ${size}px ${amber(0.45 * markOn)}`,
                borderRadius: size * 0.12,
              }}
            >
              {parts[1]}
            </span>
            {parts[2]}
          </>
        ) : (
          text
        )}
      </span>
      {scan !== undefined && scan > 0 && scan < 1 && (
        <>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${scan * 100}%`, background: amber(0.1) }} />
          <div
            style={{
              position: "absolute",
              left: `${scan * 100}%`,
              top: -4,
              bottom: -4,
              width: 3,
              background: "#ffe2b0",
              boxShadow: `0 0 14px ${amber(1)}, 0 0 40px ${amber(0.7)}`,
            }}
          />
        </>
      )}
    </div>
  );
};

// ---------- the wordmark, as in the site's header: > jevable ● ----------
/** Where the wordmark's parts sit, relative to its center, at a font size. */
export function markLayout(size: number) {
  const cw = MONO_EM * size;
  const width = cw + size * 0.3 + 7 * cw + size * 0.24 + size * 0.3;
  const left = -width / 2;
  const letters = left + cw + size * 0.3;
  return {
    width,
    chevron: left + cw / 2,
    letter: (i: number) => letters + (i + 0.5) * cw,
    dot: { x: letters + 7 * cw + size * 0.24 + size * 0.15, y: size * 0.06, r: size * 0.15 },
  };
}

/**
 * The wordmark, centered on (0, 0). `letters(i)` is each letter's arrival
 * (0..1), so they can come out of the dot one by one.
 */
export const Wordmark: React.FC<{ size: number; letters?: (i: number) => number; dot?: number; prompt?: number; dotGlow?: number; sheen?: number }> = ({
  size,
  letters = () => 1,
  dot = 1,
  prompt = 1,
  dotGlow = 1,
  sheen = 0,
}) => {
  const L = markLayout(size);
  const glyph = (x: number, ch: string, color: string, k: number, key: string, i: number) => {
    // a band of light passing over the letters, left to right
    const s = sheen > 0 && sheen < 1 ? Math.exp(-Math.pow(sheen * 10 - 1.5 - i, 2) / 1.2) : 0;
    return (
      <div
        key={key}
        style={{
          position: "absolute",
          left: x - (MONO_EM * size) / 2,
          top: -size / 2,
          width: MONO_EM * size,
          textAlign: "center",
          fontFamily: MONO,
          fontWeight: 600,
          fontSize: size,
          lineHeight: 1,
          color: s > 0.01 ? lerpColor(C.fg, "#ffe2ad", s) : color,
          textShadow: s > 0.01 ? `0 0 ${size * 0.3 * s}px ${amber(0.8 * s)}` : undefined,
          opacity: clamp01(k * 2),
          transform: `translateY(${(1 - k) * size * 0.45}px) scale(${0.75 + 0.25 * k})`,
          transformOrigin: "50% 100%",
        }}
      >
        {ch}
      </div>
    );
  };
  return (
    <div style={{ position: "relative", width: 0, height: 0 }}>
      <div style={{ position: "absolute", left: L.chevron - (MONO_EM * size) / 2 - (1 - prompt) * size * 0.6, top: -size / 2, fontFamily: MONO, fontWeight: 600, fontSize: size, lineHeight: 1, color: C.faint, opacity: prompt }}>
        &gt;
      </div>
      {"jevable".split("").map((ch, i) => glyph(L.letter(i), ch, C.fg, letters(i), `l${i}`, i))}
      <div
        style={{
          position: "absolute",
          left: L.dot.x - L.dot.r,
          top: L.dot.y - L.dot.r,
          width: 2 * L.dot.r,
          height: 2 * L.dot.r,
          borderRadius: "50%",
          background: C.wake,
          transform: `scale(${dot})`,
          boxShadow: `0 0 ${size * 0.25 * dotGlow}px ${amber(0.95)}, 0 0 ${size * 0.9 * dotGlow}px ${amber(0.45)}`,
        }}
      />
    </div>
  );
};

// ---------- the room ----------
/** The site's dot grid laid down as a floor that recedes to a horizon. */
export const Floor: React.FC<{ horizon: number; scroll?: number; glowX?: number; glow?: number; tone?: "wake" | "wrong"; opacity?: number }> = ({
  horizon,
  scroll = 0,
  glowX = W / 2,
  glow = 0,
  tone = "wake",
  opacity = 1,
}) => {
  const PW = 7000,
    PH = 3200;
  const g = tone === "wake" ? amber : red;
  return (
    <div style={{ ...full, perspective: 900, perspectiveOrigin: `${W / 2}px ${horizon - 260}px`, overflow: "hidden", opacity }}>
      <div
        style={{
          position: "absolute",
          left: W / 2 - PW / 2,
          top: horizon,
          width: PW,
          height: PH,
          transformOrigin: "50% 0%",
          transform: "rotateX(80deg)",
          backgroundImage: `radial-gradient(${white(0.22)} 2.2px, transparent 3px)`,
          backgroundSize: "56px 56px",
          backgroundPosition: `${-scroll}px 0px`,
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, #000 12%, #000 60%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, transparent 0%, #000 12%, #000 60%, transparent 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: W / 2 - PW / 2,
          top: horizon,
          width: PW,
          height: PH,
          transformOrigin: "50% 0%",
          transform: "rotateX(80deg)",
          background: `radial-gradient(ellipse 900px 1400px at ${PW / 2 + (glowX - W / 2) * 1.2}px 700px, ${g(0.55 * glow)} 0%, ${g(0.18 * glow)} 35%, transparent 70%)`,
        }}
      />
    </div>
  );
};

/** The flat dot grid from the top of jevable.sh, fading out. */
export const DotGrid: React.FC<{ opacity?: number; x?: number; y?: number; gap?: number }> = ({ opacity = 1, x = 0, y = 0, gap = 44 }) => (
  <div
    style={{
      ...full,
      opacity,
      backgroundImage: `radial-gradient(${white(0.1)} 1.6px, transparent 2.2px)`,
      backgroundSize: `${gap}px ${gap}px`,
      backgroundPosition: `${x}px ${y}px`,
      WebkitMaskImage: "radial-gradient(ellipse 70% 70% at 50% 45%, #000 25%, transparent 75%)",
      maskImage: "radial-gradient(ellipse 70% 70% at 50% 45%, #000 25%, transparent 75%)",
    }}
  />
);

export const Grain: React.FC<{ frame: number; opacity?: number }> = ({ frame, opacity = 0.07 }) => (
  <svg style={{ ...full, pointerEvents: "none", mixBlendMode: "screen", opacity }} width={W} height={H}>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves={2} seed={frame % 37} />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#grain)" />
  </svg>
);

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.6 }) => (
  <div style={{ ...full, pointerEvents: "none", background: `radial-gradient(ellipse 75% 75% at 50% 48%, transparent 45%, rgba(0,0,0,${strength}) 100%)` }} />
);

// ---------- type ----------
export type Word = { w: string; c?: string; mono?: boolean; glow?: boolean };

/** A headline whose words rise out of a mask, one after another. */
export const Words: React.FC<{ t: number; at: number; words: Word[]; size: number; step?: number; weight?: number; color?: string; out?: number; from?: "below" | "above" }> = ({
  t,
  at,
  words,
  size,
  step = 0.06,
  weight = 600,
  color = C.fg,
  out = 0,
  from = "below",
}) => (
  <div style={{ fontFamily: SANS, fontWeight: weight, fontSize: size, letterSpacing: "-0.035em", lineHeight: 1.08, color, whiteSpace: "nowrap" }}>
    {words.map((wd, i) => {
      const k = sp(t, at + i * step, { damping: 16, stiffness: 150, mass: 0.8 });
      const o = 1 - ramp(out, 0, 1, EASE.in);
      // the mask only matters while the word rises; after that it would clip the glow
      const risen = t > at + i * step + 0.6;
      return (
        <span key={i} style={{ display: "inline-block", overflow: risen ? "visible" : "hidden", verticalAlign: "bottom", padding: "0.06em 0.02em 0.14em", margin: "-0.06em 0 -0.14em" }}>
          <span
            style={{
              display: "inline-block",
              transform: `translateY(${(1 - k) * (from === "above" ? -125 : 105) + (1 - o) * -60}%)`,
              opacity: o,
              color: wd.c ?? color,
              fontFamily: wd.mono ? MONO : undefined,
              fontWeight: wd.mono ? 500 : undefined,
              textShadow: wd.glow ? `0 0 ${size * 0.5}px ${amber(0.45)}` : undefined,
              marginRight: i < words.length - 1 ? "0.25em" : 0,
            }}
          >
            {wd.w}
          </span>
        </span>
      );
    })}
  </div>
);

/** A small mono label, like the site's eyebrow. */
export const Eyebrow: React.FC<{ children: React.ReactNode; color?: string; size?: number; o?: number }> = ({ children, color = "#85858e", size = 21, o = 1 }) => (
  <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: size, letterSpacing: "0.12em", textTransform: "uppercase", color, opacity: o, whiteSpace: "nowrap" }}>
    {children}
  </div>
);

/** Rolling digits, like a meter. `value` may be fractional: the last digit rolls. */
export const Odometer: React.FC<{ value: number; decimals?: number; size: number; color?: string; prefix?: string; minDigits?: number }> = ({
  value,
  decimals = 0,
  size,
  color = C.fg,
  prefix = "",
  minDigits = 1,
}) => {
  const scaled = Math.max(0, value) * Math.pow(10, decimals);
  // count the digit that is rolling in, so 9 → 10 never shows a lone 0
  const places = Math.max(minDigits + decimals, Math.floor(Math.log10(Math.max(1, Math.ceil(scaled)))) + 1);
  const cols: React.ReactNode[] = [];
  for (let k = places - 1; k >= 0; k--) {
    const unit = Math.pow(10, k);
    const base = Math.floor(scaled / unit) % 10;
    const lower = scaled % unit;
    const roll = k === 0 ? scaled % 1 : clamp01(lower - (unit - 1));
    const pos = base + roll;
    cols.push(
      <span key={k} style={{ display: "inline-block", height: size, overflow: "hidden", verticalAlign: "top" }}>
        <span style={{ display: "flex", flexDirection: "column", transform: `translateY(${-pos * size}px)` }}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, i) => (
            <span key={i} style={{ height: size, lineHeight: `${size}px` }}>
              {d}
            </span>
          ))}
        </span>
      </span>,
    );
    if (k === decimals && decimals > 0) cols.push(<span key="dot">.</span>);
  }
  return (
    <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: size, lineHeight: `${size}px`, color, display: "inline-flex", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}>
      {prefix}
      {cols}
    </span>
  );
};

/** The agent's meter: wakes, and what they cost. Scene 1 runs it up; scene 5 runs it back down. */
export const Meter: React.FC<{
  n: number;
  money: number;
  perWake: string;
  kick?: number;
  alarm?: boolean;
  opacity?: number;
  /** What it was without jevable, crossed out above the count: [label, value]. */
  was?: [string, string];
  wasStrike?: number;
}> = ({ n, money, perWake, kick = 0, alarm, opacity = 1, was, wasStrike = 0 }) => (
  <div style={{ ...abs, left: 1180, top: was ? 40 : 84, width: 640, textAlign: "right", opacity, transform: `scale(${1 + kick * 0.08})`, transformOrigin: "100% 0%" }}>
    {was && (
      <div style={{ marginBottom: 14, fontFamily: MONO, fontSize: 26, color: C.dim, whiteSpace: "nowrap" }}>
        <span style={{ fontSize: 21, letterSpacing: "0.12em", textTransform: "uppercase", color: "#85858e", marginRight: 16 }}>{was[0]}</span>
        <span style={{ position: "relative" }}>
          {was[1]}
          <span style={{ position: "absolute", left: -4, right: -4, top: "52%", height: 3, background: C.wrong, transform: `scaleX(${wasStrike})`, transformOrigin: "0 50%" }} />
        </span>
      </div>
    )}
    <Eyebrow>{was ? "Agent wakes with jevable" : "Agent wakes"}</Eyebrow>
    <div style={{ marginTop: 10 }}>
      <Odometer value={n} size={104} color={C.fg} />
    </div>
    <div style={{ height: 22 }} />
    <Eyebrow>Spent, at ~{perWake} a wake</Eyebrow>
    <div style={{ marginTop: 10, filter: `drop-shadow(0 0 22px ${alarm ? red(0.45) : amber(0.4)})` }}>
      <Odometer value={money} decimals={2} prefix="$" size={104} color={alarm ? C.wrong : C.wake} />
    </div>
  </div>
);
/** Where the meter's dollar figure ends (its last digit), for coins to fly into. */
export const METER_MONEY = { x: 1860, y: 300 };

/** A small wake meter for the shots that are not about the count: wakes · dollars. */
export const MiniMeter: React.FC<{ n: number; money: number; kick?: number; opacity?: number }> = ({ n, money, kick = 0, opacity = 1 }) => (
  <div style={{ ...abs, left: 1420, top: 84, width: 400, textAlign: "right", opacity, transform: `scale(${1 + kick * 0.1})`, transformOrigin: "100% 0%" }}>
    <Eyebrow>Agent wakes</Eyebrow>
    <div style={{ marginTop: 8, fontFamily: MONO, fontWeight: 600, fontSize: 54, letterSpacing: "-0.03em", color: C.fg, whiteSpace: "nowrap" }}>
      {n} <span style={{ color: C.faint }}>·</span> <span style={{ color: C.wake }}>${money.toFixed(2)}</span>
    </div>
  </div>
);
export const MINI_MONEY = { x: 1850, y: 110 };

/** "+$0.12": a paid turn, flying from the agent's status light into a meter. */
export const Chip: React.FC<{ t: number; at: number; from: { x: number; y: number }; to: { x: number; y: number }; text: string; dur?: number }> = ({ t, at, from, to, text, dur = 0.5 }) => {
  const k = (t - at) / dur;
  if (k < 0 || k > 1) return null;
  const e = EASE.inOut(k);
  const x = lerp(from.x, to.x, e),
    y = (1 - e) * (1 - e) * from.y + 2 * (1 - e) * e * (Math.min(from.y, to.y) - 160) + e * e * to.y;
  return (
    <div style={{ ...abs, transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${1 - ramp(k, 0.65, 1) * 0.5})`, opacity: 1 - ramp(k, 0.5, 0.78) }}>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 28, color: "#1a1206", background: C.wake, padding: "4px 12px", borderRadius: 8, boxShadow: `0 0 24px ${amber(0.6)}`, whiteSpace: "nowrap" }}>{text}</div>
    </div>
  );
};

// ---------- effects ----------
export const Ring: React.FC<{ t: number; at: number; x: number; y: number; color?: string; max?: number; dur?: number; width?: number }> = ({
  t,
  at,
  x,
  y,
  color = C.wake,
  max = 700,
  dur = 0.7,
  width = 18,
}) => {
  const k = (t - at) / dur;
  if (k < 0 || k > 1) return null;
  const e = 1 - Math.pow(1 - k, 3);
  return (
    <svg style={{ ...abs, overflow: "visible", pointerEvents: "none" }} width={W} height={H}>
      <circle cx={x} cy={y} r={e * max} fill="none" stroke={color} strokeWidth={width * (1 - k) + 0.5} opacity={1 - k} />
    </svg>
  );
};

export const Sparks: React.FC<{ t: number; at: number; x: number; y: number; n?: number; color?: string; r0?: number; r1?: number; dur?: number; seed?: number; width?: number }> = ({
  t,
  at,
  x,
  y,
  n = 16,
  color = C.wake,
  r0 = 40,
  r1 = 360,
  dur = 0.5,
  seed = 0,
  width = 5,
}) => {
  const k = (t - at) / dur;
  if (k < 0 || k > 1) return null;
  const e = 1 - Math.pow(1 - k, 3);
  return (
    <svg style={{ ...abs, overflow: "visible", pointerEvents: "none" }} width={W} height={H}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + rand(i, seed) * 0.5;
        const len = r1 * (0.55 + 0.45 * rand(i, seed + 1));
        const head = r0 + e * len,
          tail = r0 + Math.pow(k, 0.55) * len * 0.9;
        return (
          <line
            key={i}
            x1={x + Math.cos(a) * tail}
            y1={y + Math.sin(a) * tail}
            x2={x + Math.cos(a) * head}
            y2={y + Math.sin(a) * head}
            stroke={color}
            strokeWidth={width * (1 - k)}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
};

/** A verdict tag that pops next to something: "needless wake", "missed". It fades out at `until`. */
export const Tag: React.FC<{ t: number; at: number; until?: number; children: React.ReactNode; color?: string }> = ({ t, at, until = Infinity, children, color = C.wrong }) => {
  if (t < at || t > until + 0.2) return null;
  const k = sp(t, at, { damping: 12, stiffness: 260, mass: 0.5 });
  return (
    <div
      style={{
        transform: `scale(${0.6 + 0.4 * k}) rotate(${(1 - k) * -8}deg)`,
        opacity: clamp01(k * 2) * (1 - ramp(t, until, until + 0.2)),
        fontFamily: MONO,
        fontWeight: 600,
        fontSize: 22,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color,
        padding: "8px 14px",
        border: `2px solid ${color}`,
        borderRadius: 8,
        background: "rgba(10,10,11,0.85)",
        whiteSpace: "nowrap",
        boxShadow: `0 0 24px ${color === C.wrong ? red(0.35) : amber(0.35)}`,
      }}
    >
      {children}
    </div>
  );
};
