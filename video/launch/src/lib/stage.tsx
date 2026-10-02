// The sorting line shared by scenes 2 and 4: a belt, tickets riding it, and
// a gate over it that decides what reaches the agent.
import React from "react";
import { C, MONO, MONO_EM, amber, red } from "./brand";
import { lerpColor, W } from "./ui";

export const BY = 800; // top of the belt
export const GX = 880; // the gate
/** The agent's session window at the end of the belt. */
export const SESSION = { w: 480, h: 280 };
export const AGX = 1585;
export const AGY = BY - SESSION.h / 2 - 16;
export const TW = 560; // ticket width
export const TSIZE = 26;

/** Greedy word wrap for monospace text, keeping where each line starts. */
export function wrap(text: string, cols: number) {
  const lines: { s: string; start: number }[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + cols);
    if (end < text.length) {
      const sp = text.lastIndexOf(" ", end);
      if (sp > start) end = sp;
    }
    lines.push({ s: text.slice(start, end), start });
    start = end;
    while (text[start] === " ") start++;
  }
  return lines;
}

export function ticketLayout(text: string, width = TW, size = TSIZE) {
  const padX = size * 0.8,
    padY = size * 0.7,
    lh = size * 1.32,
    head = size * 0.8 + size * 0.5;
  const cw = MONO_EM * size;
  const lines = wrap(text, Math.floor((width - 2 * padX) / cw));
  const height = padY * 2 + head + lines.length * lh;
  /** Where characters [a, b) sit, relative to the ticket's top-left. */
  const at = (a: number, b: number) => {
    const li = lines.findIndex((l, i) => a >= l.start && (i === lines.length - 1 || a < lines[i + 1].start));
    const l = lines[li];
    return { x: padX + (a - l.start) * cw, y: padY + head + li * lh + (lh - size) / 2, w: (b - a) * cw, h: size };
  };
  return { lines, height, padX, padY, lh, head, at, size };
}

export type TicketState = "idle" | "wake" | "wrong" | "dim";

/** An event as a ticket: where it came from, then its text. */
export const Ticket: React.FC<{
  text: string;
  source: string;
  width?: number;
  size?: number;
  state?: TicketState;
  matters?: boolean;
  /** Characters [a, b) to mark, how strongly, and whether the word has left the ticket. */
  mark?: [number, number];
  markOn?: number;
  lifted?: number;
  /** How far Jev's reader has passed over the ticket, 0..1. */
  scan?: number;
  read?: number;
}> = ({ text, source, width = TW, size = TSIZE, state = "idle", matters, mark, markOn = 0, lifted = 0, scan, read = 0 }) => {
  const L = ticketLayout(text, width, size);
  const border = { idle: C.lineStrong, dim: C.line, wake: amber(0.6), wrong: red(0.65) }[state];
  const bg = { idle: "#131316", dim: "#0f0f11", wake: "#2a1f0f", wrong: "#2a1414" }[state];
  const color = { idle: C.dim, dim: C.faint, wake: C.fg, wrong: C.fg }[state];
  const dot = state === "wrong" ? C.wrong : state === "wake" || matters ? C.wake : C.lineStrong;
  return (
    <div
      style={{
        position: "relative",
        width,
        height: L.height,
        borderRadius: size * 0.6,
        border: `2px solid ${border}`,
        background: `linear-gradient(180deg, ${bg}, ${lerpColor(bg, "#000000", 0.35)})`,
        boxShadow: [
          "inset 0 1px 0 rgba(255,255,255,0.06)",
          `0 ${size * 0.5}px ${size * 1.2}px rgba(0,0,0,0.6)`,
          state === "wake" ? `0 0 ${size * 1.6}px ${amber(0.4)}` : state === "wrong" ? `0 0 ${size * 1.4}px ${red(0.35)}` : "",
        ]
          .filter(Boolean)
          .join(","),
        fontFamily: MONO,
        fontSize: size,
        color,
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", left: L.padX, top: L.padY, display: "flex", alignItems: "center", gap: size * 0.4, fontSize: size * 0.72, color: C.faint, height: size * 0.8 }}>
        <span style={{ width: size * 0.36, height: size * 0.36, borderRadius: "50%", background: dot, boxShadow: dot === C.lineStrong ? undefined : `0 0 ${size * 0.6}px ${dot}` }} />
        {source}
      </div>
      {scan !== undefined && scan > 0 && (
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(1, scan) * 100}%`, background: amber(0.08 + 0.06 * read) }} />
      )}
      {L.lines.map((l, i) => {
        const y = L.padY + L.head + i * L.lh;
        const a = mark ? Math.max(mark[0] - l.start, 0) : -1;
        const z = mark ? Math.min(mark[1] - l.start, l.s.length) : -1;
        const has = mark && a < l.s.length && z > 0 && a < z;
        return (
          <div key={i} style={{ position: "absolute", left: L.padX, top: y, height: L.lh, lineHeight: `${L.lh}px`, whiteSpace: "pre" }}>
            {has ? (
              <>
                {l.s.slice(0, a)}
                <span
                  style={{
                    color: lerpColor(C.dim, "#ffd08a", markOn),
                    background: amber(0.2 * markOn * (1 - lifted)),
                    boxShadow: `0 0 0 ${size * 0.1}px ${amber(0.2 * markOn * (1 - lifted))}`,
                    borderRadius: size * 0.12,
                    opacity: 1 - lifted * 0.85,
                  }}
                >
                  {l.s.slice(a, z)}
                </span>
                {l.s.slice(z)}
              </>
            ) : (
              l.s
            )}
          </div>
        );
      })}
      {scan !== undefined && scan > 0 && scan < 1 && (
        <div
          style={{
            position: "absolute",
            left: `calc(${scan * 100}% - 2px)`,
            top: 0,
            bottom: 0,
            width: 4,
            background: "#ffe6ba",
            boxShadow: `0 0 16px ${amber(1)}, 0 0 44px ${amber(0.75)}`,
          }}
        />
      )}
    </div>
  );
};

/** The belt: slats sliding toward the agent, lit where the lamp is. */
export const Belt: React.FC<{ scroll: number; glow?: number; glowX?: number; tone?: "wake" | "wrong"; from?: number; to?: number }> = ({
  scroll,
  glow = 0,
  glowX = AGX,
  tone = "wake",
  from = -80,
  to = W + 80,
}) => {
  const g = tone === "wake" ? amber : red;
  const gap = 46;
  const off = ((scroll % gap) + gap) % gap;
  return (
    <div style={{ position: "absolute", left: from, top: BY, width: to - from, height: 34 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 6,
          background: "linear-gradient(180deg, #202025 0%, #141417 40%, #0c0c0e 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 18px 40px rgba(0,0,0,0.6)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 3,
          height: 12,
          backgroundImage: `repeating-linear-gradient(90deg, rgba(255,255,255,0.09) 0 2px, transparent 2px ${gap}px)`,
          backgroundPosition: `${off}px 0`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 6,
          background: `radial-gradient(ellipse 380px 30px at ${glowX - from}px 0px, ${g(0.5 * glow)}, transparent 70%)`,
        }}
      />
    </div>
  );
};

/** The gate's steel blade, from `top` down to the belt; `dy` moves it whole (as it drops in with its sign). */
export const Blade: React.FC<{ top: number; lift: number; dy?: number; light?: number }> = ({ top, lift, dy = 0, light = 0 }) => {
  const h = BY - top;
  return (
    <div style={{ position: "absolute", left: GX - 16, top: top + dy, width: 32, height: h, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translateY(${-lift * h}px)`,
          borderRadius: 4,
          background: "linear-gradient(90deg, #3b3b42 0%, #6b6b75 35%, #45454d 60%, #26262b 100%)",
          boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.4)",
        }}
      />
      {light > 0 && <div style={{ position: "absolute", inset: 0, background: amber(light) }} />}
    </div>
  );
};
