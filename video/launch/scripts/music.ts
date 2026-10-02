// The soundtrack, synthesized from src/cues.ts: the same times the scenes
// use, so every hit lands on its picture. No samples. Writes public/music.wav,
// covering the key-art hold (PRE) and the 30 s after it.
//   node scripts/music.ts
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BAR, BEAT, CHORDS, DURATION, M, P, PRE, SECTIONS, SCENE, arrivals, b, readerTimes, sfx, sweepAt, type Sfx } from "../src/cues.ts";
import { story } from "../src/story.ts";

// ---------- the data the mix follows (the same files the video reads) ----------
const repo = fileURLToPath(new URL("../../../", import.meta.url));
const json = (p: string) => JSON.parse(readFileSync(repo + p, "utf8"));
const runs = readdirSync(repo + "bench/wake/agent-runs")
  .filter((f) => f.endsWith(".json"))
  .map((f) => json("bench/wake/agent-runs/" + f));
const S = story({ fresh: json("bench/wake/fresh-results.json"), runs, demo: json("packages/web/src/data/demo.json"), keywords: json("bench/wake/keywords.json") });
const reads = readerTimes().map((r, i) => ({ ...r, score: S.reads[i].score, pass: S.reads[i].pass }));
const drops = S.feed.flatMap((e, i) => (e.pass ? [] : [sweepAt(i, S.feed.length)])).sort((a, z) => a - z);
const CUES: Sfx[] = sfx(arrivals(S.feed.length), reads, S.question, drops);

// ---------- setup ----------
const SR = 48000;
const N = Math.round((PRE + DURATION) * SR);
const TAU = Math.PI * 2;
const at = (t: number) => Math.round((t + PRE) * SR);
let seed = 20260928;
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const noise = () => rnd() * 2 - 1;
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, z: number, k: number) => a + (z - a) * clamp01(k);
const inRange = (t: number, [a, z]: readonly number[]) => t >= a - 1e-9 && t < z - 1e-9;

type Bus = { L: Float32Array; R: Float32Array };
const bus = (): Bus => ({ L: new Float32Array(N), R: new Float32Array(N) });
const drums = bus(),
  music = bus(),
  fx = bus(),
  rev = bus(),
  dly = bus();

function put(B: Bus, i: number, x: number, pan = 0, r = 0, d = 0) {
  if (i < 0 || i >= N) return;
  const l = Math.cos(((pan + 1) * Math.PI) / 4),
    g = Math.sin(((pan + 1) * Math.PI) / 4);
  B.L[i] += x * l;
  B.R[i] += x * g;
  if (r) {
    rev.L[i] += x * l * r;
    rev.R[i] += x * g * r;
  }
  if (d) {
    dly.L[i] += x * l * d;
    dly.R[i] += x * g * d;
  }
}

// ---------- DSP ----------
/** State-variable filter (TPT), safe to modulate per sample. */
function svf() {
  let s1 = 0,
    s2 = 0;
  return (x: number, fc: number, q = 0.707) => {
    const g = Math.tan((Math.PI * Math.min(Math.max(fc, 20), SR * 0.45)) / SR);
    const k = 1 / q;
    const hp = (x - (k + g) * s1 - s2) / (1 + k * g + g * g);
    const bp = g * hp + s1;
    const lp = g * bp + s2;
    s1 = g * hp + bp;
    s2 = g * bp + lp;
    return { lp, bp, hp };
  };
}
/** Band-limited saw (polyBLEP). */
function saw() {
  let ph = rnd();
  return (f: number) => {
    const dt = f / SR;
    ph += dt;
    if (ph >= 1) ph -= 1;
    let y = 2 * ph - 1;
    if (ph < dt) {
      const x = ph / dt;
      y -= x + x - x * x - 1;
    } else if (ph > 1 - dt) {
      const x = (ph - 1) / dt;
      y -= x * x + x + x + 1;
    }
    return y;
  };
}

// ---------- the arrangement's shape ----------
/** How open the filters are through the piece (0 muffled … 1 open). */
function energy(t: number) {
  if (t < b(4)) return lerp(0.12, 0.35, t / b(4));
  if (t < P.freeze) return lerp(0.4, 0.95, (t - b(4)) / (P.freeze - b(4)));
  if (t < SECTIONS.half[1]) return 0.5;
  if (t < SECTIONS.groove[1]) return t < SCENE.engine ? 0.8 : 0.95;
  if (t < SECTIONS.breakdown[1]) return lerp(0.3, 0.6, (t - SECTIONS.breakdown[0]) / (SECTIONS.breakdown[1] - SECTIONS.breakdown[0]));
  if (t < SECTIONS.roll[1]) return lerp(0.6, 1, (t - SECTIONS.roll[0]) / (SECTIONS.roll[1] - SECTIONS.roll[0]));
  return lerp(1, 0.7, (t - SECTIONS.groove2[0]) / (DURATION - SECTIONS.groove2[0]));
}
const kicks: number[] = [];
const beatsIn = ([a, z]: readonly number[], step = BEAT) => {
  const out: number[] = [];
  for (let t = a; t < z - 1e-6; t += step) out.push(t);
  return out;
};
kicks.push(...beatsIn(SECTIONS.build));
for (const bar of [SECTIONS.half[0], SECTIONS.half[0] + BAR]) kicks.push(bar, bar + b(2.5));
kicks.push(...beatsIn(SECTIONS.groove).filter((t) => !(t > b(27) && t < SCENE.engine)));
kicks.push(...beatsIn(SECTIONS.groove2));

// Sidechain: the music breathes with the kick.
const duck = new Float32Array(N).fill(1);
for (const k of kicks) {
  const s = at(k),
    len = Math.round(0.22 * SR);
  for (let i = 0; i < len && s + i < N; i++) duck[s + i] = Math.min(duck[s + i], 1 - 0.7 * Math.pow(1 - i / len, 2));
}

// ---------- instruments ----------
function kick(t0: number, v = 1) {
  const s = at(t0);
  let ph = 0;
  for (let i = 0; i < 0.5 * SR; i++) {
    const t = i / SR;
    ph += (TAU * (46 + 180 * Math.exp(-t / 0.028) + 40 * Math.exp(-t / 0.13))) / SR;
    const env = Math.min(1, t / 0.002) * Math.exp(-t / 0.28);
    put(drums, s + i, Math.tanh(1.7 * (Math.sin(ph) * env + noise() * Math.exp(-t / 0.0015) * 0.35)) * v * 0.9);
  }
}
function clap(t0: number, v = 1, pan = 0) {
  const s = at(t0),
    f = svf();
  for (let i = 0; i < 0.4 * SR; i++) {
    const t = i / SR;
    let env = Math.exp(-t / 0.12) * 0.6;
    for (const o of [0, 0.011, 0.022]) if (t >= o) env += Math.exp(-(t - o) / 0.004);
    put(drums, s + i, f(noise(), 1250, 1.3).bp * env * v * 1.4, pan, 0.4);
  }
}
function hat(t0: number, v = 1, open = false, pan = 0.25) {
  const s = at(t0),
    f = svf();
  for (let i = 0; i < (open ? 0.35 : 0.06) * SR; i++) {
    const t = i / SR;
    put(drums, s + i, f(noise(), 9500, 0.9).hp * Math.exp(-t / (open ? 0.1 : 0.018)) * v, pan, 0.06);
  }
}
function shaker(t0: number, v = 1) {
  const s = at(t0),
    f = svf();
  for (let i = 0; i < 0.09 * SR; i++) {
    const t = i / SR;
    put(drums, s + i, f(noise(), 6500, 1.5).bp * Math.min(1, t / 0.012) * Math.exp(-t / 0.03) * v, -0.3, 0.1);
  }
}
/** Clock: tick, tock. */
function tick(t0: number, v: number, high: boolean) {
  const s = at(t0),
    f = svf();
  let ph = 0;
  for (let i = 0; i < 0.05 * SR; i++) {
    const t = i / SR;
    ph += (TAU * (high ? 2600 : 1900)) / SR;
    put(drums, s + i, (Math.sin(ph) * 0.5 + f(noise(), 4000, 2).bp) * Math.exp(-t / 0.008) * v, high ? 0.3 : -0.3, 0.2);
  }
}
function bass(t0: number, dur: number, m: number, v: number, accent = 1) {
  const s = at(t0),
    o1 = saw(),
    o2 = saw(),
    f = svf();
  const hz = midi(m);
  let sub = 0;
  for (let i = 0; i < (dur + 0.03) * SR; i++) {
    const idx = s + i;
    if (idx >= N) break;
    const t = i / SR;
    sub += (TAU * hz) / SR;
    const e = energy(t0);
    const cut = 110 + (700 * accent + 900 * e) * Math.exp(-t / 0.08);
    const env = Math.min(1, t / 0.004) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.03) : 1);
    const x = (f(o1(hz * 2) * 0.55 + o2(hz * 2.008) * 0.55, cut, 1.2).lp + Math.sin(sub) * 0.8) * env * v * duck[idx];
    put(music, idx, Math.tanh(x * 1.4) * 0.85);
  }
}
function pad(t0: number, dur: number, notes: number[], v: number) {
  const s = at(t0);
  const voices = notes.flatMap((m, n) => [-9, 0, 9].map((c) => ({ o: saw(), f: midi(m) * Math.pow(2, c / 1200), pan: ((n * 3 + c / 9 + 7) % 5) / 5 - 0.4 })));
  const fl = svf(),
    fr = svf();
  for (let i = 0; i < (dur + 0.6) * SR; i++) {
    const idx = s + i;
    if (idx >= N) break;
    const t = i / SR,
      gt = t0 + t;
    const env = Math.min(1, t / 0.18) * (t > dur ? Math.exp(-(t - dur) / 0.18) : 1);
    let l = 0,
      r = 0;
    for (const vc of voices) {
      const x = vc.o(vc.f);
      l += x * (0.5 - vc.pan);
      r += x * (0.5 + vc.pan);
    }
    const cut = 300 + 2600 * energy(gt) + 300 * Math.sin(gt * 0.9);
    const g = (duck[idx] * env * v) / voices.length;
    const L = fl(l, cut, 0.9).lp * g,
      R = fr(r, cut, 0.9).lp * g;
    music.L[idx] += L;
    music.R[idx] += R;
    rev.L[idx] += L * 0.35;
    rev.R[idx] += R * 0.35;
  }
}
function pluck(t0: number, m: number, v: number, pan = 0) {
  const s = at(t0),
    o = saw(),
    f = svf(),
    hz = midi(m),
    e = energy(t0);
  for (let i = 0; i < 0.4 * SR; i++) {
    const idx = s + i;
    if (idx >= N) break;
    const t = i / SR;
    const x = f(o(hz), 350 + (900 + 4200 * e) * Math.exp(-t / 0.045), 2).lp * Math.exp(-t / 0.14) * v * (0.5 + 0.5 * duck[idx]);
    put(music, idx, x, pan, 0.2, 0.4);
  }
}
/** FM bell: the wake chime. */
function bell(t0: number, hz: number, v: number, dec = 0.9, pan = 0, ratio = 3.5) {
  const s = at(t0);
  for (let i = 0; i < dec * 5 * SR; i++) {
    const t = i / SR;
    const mod = Math.sin(TAU * hz * ratio * t) * 2.2 * Math.exp(-t / 0.25);
    put(fx, s + i, Math.sin(TAU * hz * t + mod) * Math.exp(-t / dec) * Math.min(1, t / 0.001) * v, pan, 0.35, 0.25);
  }
}
function tone(t0: number, hz: number, dec: number, v: number, pan = 0, bend = 0, r = 0.15) {
  const s = at(t0);
  let ph = 0;
  for (let i = 0; i < dec * 6 * SR; i++) {
    const t = i / SR;
    ph += (TAU * hz * (1 + bend * Math.exp(-t / 0.02))) / SR;
    put(fx, s + i, (Math.sin(ph) + 0.25 * Math.sin(2 * ph)) * Math.exp(-t / dec) * Math.min(1, t / 0.001) * v, pan, r);
  }
}
function click(t0: number, hz: number, dec: number, v: number, pan = 0) {
  const s = at(t0),
    f = svf();
  for (let i = 0; i < dec * 6 * SR; i++) put(fx, s + i, f(noise(), hz, 2.5).bp * Math.exp(-i / SR / dec) * v * 2, pan, 0.05);
}
function impact(t0: number, v: number) {
  const s = at(t0),
    f = svf(),
    g = svf();
  let ph = 0;
  for (let i = 0; i < 2.2 * SR; i++) {
    const t = i / SR;
    ph += (TAU * (34 + 80 * Math.exp(-t / 0.07))) / SR;
    const boom = Math.sin(ph) * Math.exp(-t / 0.6);
    const body = f(noise(), 160 + 2400 * Math.exp(-t / 0.07), 0.7).lp * Math.exp(-t / 0.3) * 0.7;
    const air = g(noise(), 5000, 0.7).hp * Math.exp(-t / 0.7) * 0.12;
    put(fx, s + i, (Math.tanh((boom + body) * 1.3) + air) * v * 0.85, 0, 0.3);
  }
}
function sweep(t0: number, d: number, v: number, up = true) {
  const s = at(t0),
    f = svf(),
    f2 = svf();
  let ph = 0;
  for (let i = 0; i < d * SR; i++) {
    const k = i / (d * SR);
    const x = up ? k : 1 - k;
    const c = 220 * Math.pow(45, x);
    ph += (TAU * 160 * Math.pow(7, x)) / SR;
    const y = f(noise(), c, 3).bp * 1.5 + f2(noise(), c * 1.6, 1.2).bp * 0.5 + Math.sin(ph) * 0.1;
    put(fx, s + i, y * Math.pow(up ? k : Math.sin(Math.PI * k), 2.2) * v, Math.sin(k * 8) * 0.5, 0.4);
  }
}
function whoosh(t0: number, d: number, v: number) {
  const s = at(t0),
    f = svf();
  for (let i = 0; i < d * SR; i++) {
    const k = i / (d * SR);
    put(fx, s + i, f(noise(), 500 + 3800 * Math.sin(Math.PI * k), 1.6).bp * Math.pow(Math.sin(Math.PI * Math.pow(k, 0.7)), 2) * v * 1.5, lerp(-0.8, 0.8, k), 0.25);
  }
}
function suck(t0: number, d: number, v: number) {
  const s = at(t0),
    f = svf();
  for (let i = 0; i < d * SR; i++) {
    const k = i / (d * SR);
    put(fx, s + i, f(noise(), 300 + 7000 * k * k, 2).bp * Math.pow(k, 3) * v * 1.4, (1 - k) * 0.5 * Math.sin(k * 18), 0.2);
  }
}
/** Steel plate: inharmonic partials and a scrape. */
function clank(t0: number, v: number) {
  const s = at(t0),
    f = svf();
  const parts = [
    [187, 1, 0.5],
    [431, 0.7, 0.35],
    [719, 0.5, 0.28],
    [1123, 0.35, 0.2],
    [1664, 0.25, 0.14],
    [2310, 0.18, 0.1],
  ];
  for (let i = 0; i < 1.6 * SR; i++) {
    const t = i / SR;
    let x = f(noise(), 1800, 0.8).bp * Math.exp(-t / 0.02) * 1.2;
    for (const [hz, a, d] of parts) x += Math.sin(TAU * hz * t * (1 + 0.002 * Math.sin(t * 40))) * a * Math.exp(-t / d);
    put(fx, s + i, x * v * 0.45, 0.1, 0.35);
  }
}
function sour(t0: number, v: number) {
  // two detuned squares a tritone apart: wrong
  const s = at(t0);
  for (let i = 0; i < 0.32 * SR; i++) {
    const t = i / SR;
    const sq = (hz: number) => Math.sign(Math.sin(TAU * hz * t)) * 0.5;
    const env = Math.min(1, t / 0.005) * Math.exp(-t / 0.12);
    put(fx, s + i, (sq(233) + sq(329.6) + sq(236)) * env * v * 0.22, -0.15, 0.15);
  }
}
function thud(t0: number, v: number) {
  const s = at(t0),
    f = svf();
  let ph = 0;
  for (let i = 0; i < 0.4 * SR; i++) {
    const t = i / SR;
    ph += (TAU * (70 + 90 * Math.exp(-t / 0.03))) / SR;
    put(fx, s + i, (Math.sin(ph) * Math.exp(-t / 0.12) + f(noise(), 900, 1).bp * Math.exp(-t / 0.03)) * v * 0.9, -0.2, 0.1);
  }
}
function crack(t0: number, v: number) {
  const s = at(t0),
    f = svf();
  for (let i = 0; i < 0.6 * SR; i++) {
    const t = i / SR;
    const grain = rnd() < 0.02 * Math.exp(-t / 0.15) ? noise() : 0;
    put(fx, s + i, (f(noise(), 2600, 1).bp * Math.exp(-t / 0.05) + grain) * v, noise() * 0.5, 0.3);
  }
}
/** Jev's needle: a glide up to a pitch that says the score. */
function needle(t0: number, d: number, score: number, v: number) {
  const s = at(t0);
  const to = 330 * Math.pow(2, score * 1.5);
  let ph = 0;
  for (let i = 0; i < (d + 0.12) * SR; i++) {
    const t = i / SR;
    const k = clamp01(t / d);
    ph += (TAU * lerp(260, to, 1 - Math.pow(1 - k, 3))) / SR;
    const env = Math.min(1, t / 0.01) * (t > d ? Math.exp(-(t - d) / 0.04) : 1);
    put(fx, s + i, (Math.sin(ph) + 0.3 * Math.sin(3 * ph)) * env * v * 0.35, 0.2, 0.2, 0.15);
  }
}

// ---------- sequence the music ----------
const VOICE: Record<string, { pad: number[]; bass: number }> = {
  Dm: { pad: [50, 57, 62, 65, 69], bass: 38 },
  Bb: { pad: [46, 53, 58, 62, 65], bass: 34 },
  Gm: { pad: [43, 50, 55, 58, 62], bass: 31 },
  A: { pad: [45, 52, 57, 61, 64], bass: 33 },
  F: { pad: [41, 48, 53, 57, 60], bass: 29 },
  C: { pad: [48, 52, 55, 60, 64], bass: 36 },
};
const chordAt = (t: number) => VOICE[CHORDS[Math.min(CHORDS.length - 1, Math.max(0, Math.floor(t / BAR)))]];
const silent = (t: number) => t >= P.freeze && t < SECTIONS.half[0];

CHORDS.forEach((name, i) => {
  const t = i * BAR;
  if (silent(t)) return;
  const lvl = t < b(4) ? 0.5 : inRange(t, SECTIONS.breakdown) ? 0.75 : t >= b(60) ? 0.7 : 0.55;
  const dur = i === CHORDS.length - 1 ? DURATION - t : BAR;
  pad(t, dur, VOICE[name].pad, lvl);
});
// a drone under the cold open
bass(0, b(4) - 0.02, 38, 0.35, 0.1);

for (const t of kicks) kick(t, 0.95);
for (const t of beatsIn(SECTIONS.groove).concat(beatsIn(SECTIONS.groove2))) if (Math.round(t / BEAT) % 2 === 1) clap(t, 0.5, 0);
for (const bar of [SECTIONS.half[0], SECTIONS.half[0] + BAR]) clap(bar + b(2), 0.55);
// the clock in the cold open, and into the build
for (const t of beatsIn([0, P.freeze])) tick(t, t < b(4) ? 0.35 : 0.18, Math.round(t / BEAT) % 2 === 0);
// hats: offbeat 8ths; 16th ghosts where it runs hot
for (const t of beatsIn([b(4), P.freeze], BEAT / 4).concat(beatsIn(SECTIONS.groove, BEAT / 4), beatsIn(SECTIONS.groove2, BEAT / 4))) {
  const q = Math.round(t / (BEAT / 4)) % 4;
  const hot = t >= b(8) && t < P.freeze ? true : t >= SCENE.engine && t < SCENE.proof ? true : t >= SECTIONS.groove2[0];
  if (q === 2) hat(t, 0.32, Math.round(t / BEAT) % 4 === 3);
  else if (hot && q !== 0) hat(t, 0.1 + 0.04 * rnd());
}
for (const t of beatsIn(SECTIONS.half, BEAT / 2)) shaker(t, 0.35);
// snare rolls into the freeze and into the stamp
for (const [a, z] of [
  [b(9), P.freeze],
  [SECTIONS.roll[0], SECTIONS.roll[1]],
]) {
  for (let t = a; t < z - 1e-6; t += z - t > b(1) ? BEAT / 2 : BEAT / 4) clap(t, 0.12 + 0.4 * ((t - a) / (z - a)), 0.1);
}
// bass
for (const t of beatsIn([b(4), P.freeze], BEAT / 2)) bass(t, BEAT / 2 - 0.03, chordAt(t).bass, Math.round(t / (BEAT / 2)) % 2 ? 0.55 : 0.3, 0.8);
for (const bar of [SECTIONS.half[0], SECTIONS.half[0] + BAR]) bass(bar, BAR - 0.05, chordAt(bar).bass, 0.5, 0.3);
for (const t of beatsIn(SECTIONS.groove, BEAT / 2).concat(beatsIn(SECTIONS.groove2, BEAT / 2))) {
  const off = Math.round(t / (BEAT / 2)) % 2 === 1;
  const oct = off && Math.round(t / BEAT) % 4 === 3 ? 12 : 0;
  bass(t, BEAT / 2 - 0.03, chordAt(t).bass + oct, off ? 0.55 : 0.3, off ? 1 : 0.4);
}
for (const bar of [SECTIONS.breakdown[0], SECTIONS.breakdown[0] + BAR]) bass(bar, Math.min(BAR, SECTIONS.roll[0] - bar) - 0.05, chordAt(bar).bass, 0.45, 0.2);
bass(SECTIONS.roll[0], SECTIONS.roll[1] - SECTIONS.roll[0] - 0.05, chordAt(SECTIONS.roll[0]).bass, 0.45, 0.4);
bass(SECTIONS.groove2[1], DURATION - SECTIONS.groove2[1] - 0.2, 29, 0.45, 0.2);
// arp: 8ths under the reveal, 16ths through the reader and the proof, up an octave after the stamp
const ARP = [0, 2, 4, 1, 3, 2, 4, 3];
for (const [range, step, up, v] of [
  [[SCENE.reveal + b(0.25), SCENE.engine], BEAT / 2, 12, 0.14],
  [[SCENE.engine, SCENE.proof - b(0.5)], BEAT / 4, 12, 0.13],
  [SECTIONS.breakdown, BEAT / 4, 12, 0.08],
  [[SECTIONS.groove2[0], b(62)], BEAT / 4, 24, 0.11],
] as [number[], number, number, number][]) {
  beatsIn(range, step).forEach((t, i) => pluck(t, chordAt(t).pad[ARP[i % ARP.length]] + up, v, i % 2 ? 0.35 : -0.35));
}

// ---------- sound design, from the cue sheet ----------
for (const c of CUES) {
  const v = c.v ?? 0.5,
    p = c.p ?? 1,
    d = c.d ?? 0.5;
  switch (c.type) {
    case "wake":
      bell(c.t, 587.33 * p, v * 0.55, 0.35, (rnd() - 0.5) * 0.6, 2);
      tone(c.t, 587.33 * p * 2, 0.04, v * 0.35);
      break;
    case "ding":
      bell(c.t, 880 * p, v, 1.2, 0, 3.5);
      break;
    case "impact":
      impact(c.t, v);
      if (c.t > 0) hat(c.t, v * 0.5, true, 0);
      break;
    case "coin":
      bell(c.t, 1975.5, v * 0.5, 0.12, 0.5, 1.5);
      bell(c.t + 0.045, 2637, v * 0.45, 0.2, 0.5, 1.5);
      break;
    case "register":
      bell(c.t, 2093, v * 0.6, 0.5, 0.2, 1.41);
      bell(c.t + 0.06, 2637, v * 0.5, 0.6, -0.2, 1.41);
      click(c.t, 3000, 0.01, v);
      break;
    case "riser":
      sweep(c.t, d, v, true);
      break;
    case "suck":
      suck(c.t, d, v);
      break;
    case "whoosh":
      whoosh(c.t, d, v);
      break;
    case "clank":
      clank(c.t, v);
      break;
    case "lock":
      click(c.t, 2200, 0.006, v);
      tone(c.t, 140, 0.05, v * 0.9, 0, 0.8, 0.05);
      break;
    case "sour":
      sour(c.t, v);
      break;
    case "thud":
      thud(c.t, v);
      break;
    case "pop":
      tone(c.t, 540 * p, 0.03, v, (rnd() - 0.5) * 0.5, 0.5);
      break;
    case "tick":
      click(c.t, 3400, 0.006, v * 0.9);
      tone(c.t, 1900, 0.012, v * 0.3);
      break;
    case "key":
      click(c.t, 2300 + rnd() * 1700, 0.004, v, (rnd() - 0.5) * 0.4);
      break;
    case "enter":
      click(c.t, 1500, 0.012, v);
      tone(c.t, 160, 0.06, v * 0.8, 0, 1.2, 0.1);
      break;
    case "scan":
      sweep(c.t, Math.max(0.05, d), v * 0.6, true);
      break;
    case "needle":
      needle(c.t, Math.max(0.05, d), p, v);
      break;
    case "drop":
      tone(c.t, 420, 0.09, v, -0.3, -0.5, 0.1);
      break;
    case "crack":
      crack(c.t, v);
      break;
    default:
      throw new Error(`unknown sound ${c.type}`);
  }
}
// the proof's meter rolling down as the blade passes
for (const t of beatsIn(M.sweep, BEAT / 4)) tone(t, 2200 - 900 * ((t - M.sweep[0]) / (M.sweep[1] - M.sweep[0])), 0.012, 0.1, 0.3);

// ---------- the freeze: a tape stop on everything musical ----------
for (const B of [music, drums, rev, dly]) {
  const s = at(P.freeze),
    stop = Math.round(0.45 * SR),
    end = at(SECTIONS.half[0]);
  const L = B.L.slice(s, s + stop * 2),
    R = B.R.slice(s, s + stop * 2);
  let pos = 0;
  for (let i = 0; i < end - s; i++) {
    const rate = i < stop ? Math.pow(1 - i / stop, 1.6) : 0;
    const j = Math.floor(pos),
      fr = pos - j;
    const g = i < stop ? 1 : 0;
    B.L[s + i] = g * ((L[j] ?? 0) * (1 - fr) + (L[j + 1] ?? 0) * fr);
    B.R[s + i] = g * ((R[j] ?? 0) * (1 - fr) + (R[j + 1] ?? 0) * fr);
    pos += rate;
  }
}

// ---------- effects: ping-pong delay, then a plate-ish reverb ----------
{
  const d = Math.round(BEAT * 0.75 * SR);
  const lp = svf(),
    rp = svf();
  for (let i = d; i < N; i++) {
    dly.L[i] += lp(dly.R[i - d], 3200).lp * 0.4;
    dly.R[i] += rp(dly.L[i - d], 3200).lp * 0.4;
  }
  for (let i = 0; i < N; i++) {
    music.L[i] += dly.L[i] * 0.3;
    music.R[i] += dly.R[i] * 0.3;
    rev.L[i] += dly.L[i] * 0.1;
    rev.R[i] += dly.R[i] * 0.1;
  }
}
function reverb(input: Float32Array, spread: number) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map((n) => ({ buf: new Float32Array(Math.round(((n + spread) * SR) / 44100)), i: 0, z: 0 }));
  const aps = [225, 556, 441, 341].map((n) => ({ buf: new Float32Array(Math.round(((n + spread) * SR) / 44100)), i: 0 }));
  const out = new Float32Array(N);
  for (let s = 0; s < N; s++) {
    const x = input[s] * 0.02;
    let y = 0;
    for (const c of combs) {
      const o = c.buf[c.i];
      c.z = o * 0.72 + c.z * 0.28;
      c.buf[c.i] = x + c.z * 0.85;
      if (++c.i >= c.buf.length) c.i = 0;
      y += o;
    }
    for (const a of aps) {
      const o = a.buf[a.i];
      a.buf[a.i] = y + o * 0.5;
      y = o - y;
      if (++a.i >= a.buf.length) a.i = 0;
    }
    out[s] = y;
  }
  return out;
}
const revL = reverb(rev.L, 0),
  revR = reverb(rev.R, 23);

// ---------- master ----------
const outL = new Float32Array(N),
  outR = new Float32Array(N);
{
  const hl = svf(),
    hr = svf();
  for (let i = 0; i < N; i++) {
    const t = i / SR - PRE;
    const fade = t > DURATION - 0.5 ? Math.max(0, (DURATION - t) / 0.5) : 1;
    outL[i] = hl(drums.L[i] * 0.85 + music.L[i] * 0.8 + fx.L[i] * 0.8 + revL[i], 28).hp * fade;
    outR[i] = hr(drums.R[i] * 0.85 + music.R[i] * 0.8 + fx.R[i] * 0.8 + revR[i], 28).hp * fade;
  }
}

/** Integrated loudness (ITU-R BS.1770: K-weighting, 400 ms blocks, gated). */
function lufs(L: Float32Array, R: Float32Array) {
  const kw = (x: Float32Array) => {
    const y = new Float32Array(x.length);
    const st = [
      { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [-1.69065929318241, 0.73248077421585], x1: 0, x2: 0, y1: 0, y2: 0 },
      { b: [1, -2, 1], a: [-1.99004745483398, 0.99007225036621], x1: 0, x2: 0, y1: 0, y2: 0 },
    ];
    for (let i = 0; i < x.length; i++) {
      let v = x[i];
      for (const s of st) {
        const o = s.b[0] * v + s.b[1] * s.x1 + s.b[2] * s.x2 - s.a[0] * s.y1 - s.a[1] * s.y2;
        s.x2 = s.x1;
        s.x1 = v;
        s.y2 = s.y1;
        s.y1 = o;
        v = o;
      }
      y[i] = v;
    }
    return y;
  };
  const kl = kw(L),
    kr = kw(R);
  const block = Math.round(0.4 * SR),
    hop = Math.round(0.1 * SR);
  const z: number[] = [];
  for (let s = 0; s + block <= kl.length; s += hop) {
    let m = 0;
    for (let i = s; i < s + block; i++) m += kl[i] * kl[i] + kr[i] * kr[i];
    z.push(m / block);
  }
  const loud = (m: number) => -0.691 + 10 * Math.log10(m);
  const abs = z.filter((m) => loud(m) > -70);
  const rel = loud(abs.reduce((a, c) => a + c, 0) / abs.length) - 10;
  const gated = abs.filter((m) => loud(m) > rel);
  return loud(gated.reduce((a, c) => a + c, 0) / gated.length);
}

/** Lookahead peak limiter. */
function limit(L: Float32Array, R: Float32Array, ceiling: number) {
  const look = Math.round(0.003 * SR),
    rel = Math.exp(-1 / (0.08 * SR));
  const need = new Float32Array(N);
  for (let i = 0; i < N; i++) need[i] = Math.min(1, ceiling / Math.max(1e-9, Math.abs(L[i]), Math.abs(R[i])));
  let env = 1;
  for (let i = 0; i < N; i++) {
    let target = 1;
    for (let j = i; j < Math.min(N, i + look); j++) target = Math.min(target, need[j]);
    env = target < env ? target : target - (target - env) * rel;
    L[i] *= env;
    R[i] *= env;
  }
}

const TARGET = -13;
const CEIL = Math.pow(10, -2.2 / 20); // sample peak; keeps true peak under −1 dBTP after AAC
for (let pass = 0; pass < 3; pass++) {
  const g = Math.pow(10, (TARGET - lufs(outL, outR)) / 20);
  for (let i = 0; i < N; i++) {
    outL[i] *= g;
    outR[i] *= g;
  }
  limit(outL, outR, CEIL);
}
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(outL[i]), Math.abs(outR[i]));

// ---------- write ----------
const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, outL[i])) * 32767), i * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, outR[i])) * 32767), i * 4 + 2);
}
const h = Buffer.alloc(44);
h.write("RIFF", 0);
h.writeUInt32LE(36 + data.length, 4);
h.write("WAVE", 8);
h.write("fmt ", 12);
h.writeUInt32LE(16, 16);
h.writeUInt16LE(1, 20);
h.writeUInt16LE(2, 22);
h.writeUInt32LE(SR, 24);
h.writeUInt32LE(SR * 4, 28);
h.writeUInt16LE(4, 32);
h.writeUInt16LE(16, 34);
h.write("data", 36);
h.writeUInt32LE(data.length, 40);
mkdirSync(new URL("../public/", import.meta.url), { recursive: true });
writeFileSync(new URL("../public/music.wav", import.meta.url), Buffer.concat([h, data]));
console.log(`public/music.wav: ${(N / SR).toFixed(2)} s, ${lufs(outL, outR).toFixed(1)} LUFS integrated, peak ${(20 * Math.log10(peak)).toFixed(1)} dBFS, ${CUES.length} cues`);
