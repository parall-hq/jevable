// Motion helpers. Everything takes absolute time t in seconds, so cue values
// from cues.ts can be used as they are.
import { Easing, spring } from "remotion";
import { noise2D } from "@remotion/noise";
import { FPS } from "../cues";

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export const EASE = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  in: Easing.bezier(0.55, 0, 1, 0.45),
  whip: Easing.bezier(0.85, 0, 0.15, 1),
  linear: (x: number) => x,
};

/** 0 → 1 between times a and b. */
export const ramp = (t: number, a: number, b: number, ease: (x: number) => number = EASE.out) =>
  ease(clamp01((t - a) / (b - a)));

/** A spring that starts at `at`. */
export const sp = (t: number, at: number, config: Partial<{ damping: number; stiffness: number; mass: number }> = {}) =>
  t < at ? 0 : spring({ frame: (t - at) * FPS, fps: FPS, config: { damping: 14, stiffness: 180, mass: 0.7, ...config } });

/** Piecewise-linear map with clamping, then an optional ease per segment. */
export const map = (v: number, xs: number[], ys: number[]) => {
  if (v <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) {
    if (v <= xs[i]) return lerp(ys[i - 1], ys[i], (v - xs[i - 1]) / (xs[i] - xs[i - 1]));
  }
  return ys[ys.length - 1];
};

/** Sum of decaying envelopes from event times: a visual transient. */
export const pulse = (t: number, times: number[], decay = 0.12) => {
  let v = 0;
  for (const at of times) if (t >= at && t - at < decay * 8) v += Math.exp(-(t - at) / decay);
  return Math.min(1, v);
};

/** 1 at `at`, then a damped oscillation to 0. */
export const wobble = (t: number, at: number, freq = 22, decay = 0.14) =>
  t < at ? 0 : Math.exp(-(t - at) / decay) * Math.cos((t - at) * freq);

/** Camera shake from impacts: [time, amplitude in px]. */
export const shake = (t: number, hits: [number, number][], seed = "s") => {
  let a = 0;
  for (const [at, amp] of hits) if (t >= at) a += amp * Math.exp(-(t - at) / 0.13);
  return {
    x: noise2D(seed + "x", t * 30, 0) * a,
    y: noise2D(seed + "y", t * 30, 0) * a,
    r: noise2D(seed + "r", t * 22, 0) * a * 0.04,
  };
};

/** Slow handheld drift, for a camera that is never quite still. */
export const drift = (t: number, amp = 6, seed = "d") => ({
  x: noise2D(seed + "x", t * 0.35, 0) * amp,
  y: noise2D(seed + "y", t * 0.35, 0) * amp,
});

/** Deterministic hash random in [0, 1). */
export const rand = (i: number, salt = 0) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Position along a quadratic Bézier. */
export const bez = (p0: number, p1: number, p2: number, k: number) => (1 - k) * (1 - k) * p0 + 2 * (1 - k) * k * p1 + k * k * p2;
