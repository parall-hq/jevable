// jevable's brand, as on jevable.sh (packages/web/src/styles/global.css).
import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";

export const C = {
  bg: "#0a0a0b",
  raised: "#111113",
  sunken: "#070708",
  line: "#1e1e22",
  lineStrong: "#2b2b31",
  fg: "#ececef",
  dim: "#a1a1aa",
  faint: "#66666e",
  wake: "#ffb547",
  wrong: "#f87171",
};

/** Amber ("wakes / matters") and red ("wrong") at an alpha. */
export const amber = (a: number) => `rgba(255,181,71,${a})`;
export const red = (a: number) => `rgba(248,113,113,${a})`;
export const white = (a: number) => `rgba(236,236,239,${a})`;

export const SANS = loadGeist("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] }).fontFamily;
export const MONO = loadGeistMono("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin", "latin-ext"] }).fontFamily;

/** Width of one Geist Mono character, in em. */
export const MONO_EM = 0.6;
