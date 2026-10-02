// The agent: a Claude Code session, drawn in jevable's own style (the name as
// text, no marks). Its status light is the amber dot. Asleep, it waits at the
// prompt; each wake adds a Monitor event, starts a turn, and maybe replies.
import React from "react";
import { C, MONO, SANS, amber } from "./brand";
import { clamp01, ramp } from "./anim";

export type Line = { at: number; kind: "event" | "think" | "reply"; text?: string; tone?: "dim" | "fg" | "amber" };

/** A wake, as the session shows it: the Monitor event, a turn starting, and (optionally) the reply. */
export const wakeLines = (at: number, event: string, reply?: string, tone: Line["tone"] = "fg"): Line[] => [
  { at, kind: "event", text: event },
  { at: at + 0.08, kind: "think" },
  ...(reply ? [{ at: at + 0.55, kind: "reply" as const, text: reply, tone }] : []),
];

/** Where the status light sits, relative to the window's center. */
export const lightAt = (w: number, h: number) => ({ x: w / 2 - 30, y: -h / 2 + 23 });

export const Session: React.FC<{
  t: number;
  w: number;
  h: number;
  lines: Line[];
  lit: number;
  jolt?: number;
  sleep?: number;
}> = ({ t, w, h, lines, lit, jolt = 0, sleep = 0 }) => {
  const L = clamp01(lit);
  const bar = 46;
  const fs = 16;
  const lh = fs * 1.62;
  const pad = 20;
  const rows = Math.floor((h - bar - pad * 2) / lh) - 1; // the last row is the prompt
  const seen = lines.filter((l) => l.at <= t);
  // a turn's "Thinking…" shows only while it is the latest thing on screen
  const shown = seen.filter((l, i) => l.kind !== "think" || i === seen.length - 1);
  const last = shown.slice(-rows);
  const newest = last[last.length - 1];
  const enter = newest ? ramp(t, newest.at, newest.at + 0.1) : 1;
  const scroll = shown.length > rows ? (1 - enter) * lh : 0;
  const busy = newest && newest.kind !== "reply" && t - newest.at < 1.2;
  const light = lightAt(w, h);

  return (
    <div style={{ position: "relative", width: w, height: h, transform: `scale(${1 + jolt * 0.04}, ${1 - jolt * 0.025})` }}>
      {/* the light the session throws into the room when it wakes */}
      <div style={{ position: "absolute", left: -w * 0.4, top: -h * 0.6, width: w * 1.8, height: h * 2.2, borderRadius: "50%", background: `radial-gradient(ellipse, ${amber(0.2 * L)} 0%, transparent 62%)` }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 16,
          overflow: "hidden",
          background: "linear-gradient(180deg, #151518 0%, #0d0d0f 100%)",
          border: `1.5px solid ${L > 0.05 ? amber(0.25 + 0.5 * L) : C.lineStrong}`,
          boxShadow: ["inset 0 1px 0 rgba(255,255,255,0.06)", "0 40px 90px rgba(0,0,0,0.7)", `0 0 ${60 * L}px ${amber(0.3 * L)}`].join(","),
        }}
      >
        {/* title bar */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: bar, borderBottom: `1px solid ${C.line}`, background: "linear-gradient(180deg, #1a1a1e, #141417)" }}>
          <div style={{ position: "absolute", left: 18, top: bar / 2 - 5, display: "flex", gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: "#2c2c33" }} />
            ))}
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: bar, lineHeight: `${bar}px`, textAlign: "center", fontFamily: SANS, fontWeight: 600, fontSize: 18, color: L > 0.3 ? C.fg : C.dim, letterSpacing: "-0.01em" }}>
            Claude Code
          </div>
        </div>
        {/* the log */}
        <div style={{ position: "absolute", left: pad, right: pad, top: bar + pad, height: rows * lh, overflow: "hidden", fontFamily: MONO, fontSize: fs, lineHeight: `${lh}px` }}>
          <div style={{ transform: `translateY(${scroll}px)` }}>
            {last.map((l, i) => {
              const k = l === newest ? enter : 1;
              return (
                <div key={`${l.at}-${i}`} style={{ height: lh, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: k, display: "flex", alignItems: "center", gap: 10 }}>
                  {l.kind === "event" && (
                    <>
                      <span style={{ width: 9, height: 9, borderRadius: "50%", background: C.wake, flex: "none", boxShadow: `0 0 8px ${amber(0.8)}` }} />
                      <span style={{ color: C.fg, fontWeight: 600, flex: "none" }}>Monitor</span>
                      <span style={{ color: C.faint, flex: "none" }}>·</span>
                      <span style={{ color: C.dim, overflow: "hidden", textOverflow: "ellipsis" }}>{l.text}</span>
                    </>
                  )}
                  {l.kind === "think" && (
                    <>
                      <span style={{ width: 9, height: 9, flex: "none", background: C.wake, transform: `rotate(${t * 360}deg) scale(${0.8 + 0.2 * Math.sin(t * 14)})`, borderRadius: 2 }} />
                      <span style={{ color: "#e3a24a" }}>Thinking{".".repeat(1 + (Math.floor(t * 6) % 3))}</span>
                    </>
                  )}
                  {l.kind === "reply" && (
                    <>
                      <span style={{ width: 12, height: 10, flex: "none", borderLeft: `2px solid ${C.faint}`, borderBottom: `2px solid ${C.faint}`, marginLeft: 3, marginTop: -8 }} />
                      <span style={{ color: l.tone === "amber" ? C.wake : l.tone === "dim" ? C.dim : C.fg }}>{l.text}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {/* the prompt, waiting */}
        <div style={{ position: "absolute", left: pad, right: pad, bottom: pad - 4, height: lh, lineHeight: `${lh}px`, fontFamily: MONO, fontSize: fs, color: C.faint, borderTop: `1px solid ${C.line}`, paddingTop: 4 }}>
          &gt;{" "}
          <span style={{ display: "inline-block", width: fs * 0.55, height: fs * 1.05, verticalAlign: "middle", background: busy ? "transparent" : C.dim, opacity: Math.floor(t * 2.4) % 2 ? 0.8 : 0.2 }} />
        </div>
      </div>
      {/* the status light: the amber dot */}
      <div style={{ position: "absolute", left: w / 2 + light.x - 7, top: h / 2 + light.y - 7, width: 14, height: 14, borderRadius: "50%", background: "#26262b", boxShadow: "inset 0 1px 2px rgba(255,255,255,0.15)" }} />
      <div style={{ position: "absolute", left: w / 2 + light.x - 7, top: h / 2 + light.y - 7, width: 14, height: 14, borderRadius: "50%", background: C.wake, opacity: L, boxShadow: `0 0 10px ${amber(1)}, 0 0 30px ${amber(0.7)}, 0 0 70px ${amber(0.4)}` }} />
      {sleep > 0.01 &&
        [0, 1, 2].map((i) => {
          const k = ((t + i * 0.62) % 1.86) / 1.86;
          return (
            <div key={i} style={{ position: "absolute", left: w + 8 + k * 40, top: -10 - k * 70, fontFamily: MONO, fontWeight: 600, fontSize: 22 + k * 14, color: C.faint, opacity: sleep * Math.sin(Math.PI * k) }}>
              z
            </div>
          );
        })}
    </div>
  );
};
