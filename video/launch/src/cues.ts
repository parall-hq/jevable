// The one place times live. Every scene and scripts/music.ts read from here,
// so each hit on screen lands on a hit in the mix. Times are seconds from the
// cold open; the key-art hold (PRE) comes before 0. 128 BPM: 16 bars = 30 s.
// Plain TypeScript with no imports: node runs it as is for the music.

export const BPM = 128;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const FPS = 60;
export const BARS = 16;
export const DURATION = BARS * BAR;
/** Key art held before the cold open (feeds thumbnail an early frame); its last THUMB_EXIT s carry its dot into the agent's lamp. */
export const PRE = 0.5;
export const THUMB_EXIT = 0.2;

/** Beats from the cold open → seconds. */
export const b = (beats: number) => beats * BEAT;

export const SCENE = {
  problem: b(0),
  grep: b(11.5),
  /** The dive into the stencil's dot ends here; the dot closes into jevable's dot on R.dot. */
  reveal: b(19.75),
  engine: b(28),
  proof: b(40),
  outro: b(56),
  end: b(64),
};

// ---------- 1. every line wakes it ----------
export const P = {
  header: b(4),
  pullBack: [b(3.5), b(9)] as [number, number],
  flood: [b(7.5), b(10.5)] as [number, number],
  /** Everything stops on 334 wakes; the stencil drops at G.slam. */
  freeze: b(10.5),
  fall: [b(11.5), b(12.4)] as [number, number],
};

/** Quarters, 8ths, 16ths: the wakes you can follow one by one, before the flood. */
const SLOW_BEATS = [1, 2, 3, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.25];
export const SLOW = SLOW_BEATS.length;

/** When each of `n` events reaches the agent: one by one, then a flood that keeps accelerating until the freeze. */
export function arrivals(n: number): number[] {
  const out = SLOW_BEATS.map(b);
  const m = n - out.length;
  const [a, z] = P.flood;
  for (let k = 1; k <= m; k++) out.push(a + (z - a - 0.08) * Math.sqrt(k / m));
  return out;
}

// ---------- 2. grep wakes it for words ----------
export const G = {
  slam: b(12),
  header: b(12.5),
  /** The word fits the stencil and the card goes through: the agent wakes at pass + b(0.5). */
  pass: [b(14)],
  flip: b(16),
  /** A card that mattered hits the gate without the word and drops off the belt. */
  miss: [b(17), b(18)],
  /** Into the stencil's dot; it is an orb in the middle of the frame at SCENE.reveal. */
  dive: b(19),
};

// ---------- 3. reveal ----------
export const R = {
  dot: b(20),
  letters: b(20.25),
  tagline: b(22),
  lift: b(24),
  /** The command is typed up to its question; the question, too long to watch being typed, lands whole. */
  type: [b(24.25), b(25.25)] as [number, number],
  question: b(25.5),
  enter: b(26.5),
  /** The frame held as key art before the cold open. */
  thumb: b(27.2),
  dive: b(27.25),
};

// ---------- 4. one question per line ----------
export const E = {
  open: b(28),
  question: b(28.25),
  /** When each card enters Jev's reader. */
  scans: [b(29), b(31.25), b(33.5), b(35.75)],
  facts: b(33.5),
  /** The reader's blade carries on into the proof. */
  out: b(38.25),
};
/**
 * Each card at Jev's reader: it rolls in (`enter` → `scan`), is read (`scan`
 * → `read`, the needle settles on Jev's score), then leaves: along the belt to
 * the agent, waking it at `leave`, or off the belt. The next card only rolls in after.
 */
export const readerTimes = () => E.scans.map((scan) => ({ enter: scan - b(0.6), scan, read: scan + b(0.6), leave: scan + b(1.25) }));

// ---------- 5. proof ----------
export const M = {
  in: b(40),
  /** The 334 events, every one lit: every one woke the agent. */
  light: [b(40), b(40.25)] as [number, number],
  /** Jev's blade passes over them; only the ones that pass stay lit. The count lands on 46 just before the stamp. */
  sweep: [b(40.25), b(47.5)] as [number, number],
  riser: [b(45.5), b(48)] as [number, number],
  slam: b(48),
  caught: b(51.5),
  dots: [b(51.75), b(52.75)] as [number, number],
  fine: b(52.25),
  out: b(55.5),
};
/** The 334 lines stand in WALL_COLS columns; the blade reaches line `i` of `n` at this time. */
export const WALL_COLS = 6;
export function sweepAt(i: number, n: number) {
  const rows = Math.ceil(n / WALL_COLS);
  const col = Math.floor(i / rows),
    row = i % rows;
  const [a, z] = M.sweep;
  return a + ((col + 0.5) / WALL_COLS) * (z - a) + (row / rows) * 0.06;
}

// ---------- 6. one prompt, any agent ----------
export const O = {
  dot: b(56),
  header: b(56.5),
  /** The call to action: typed fast, then held to the end. */
  prompt: [b(56.75), b(57.75)] as [number, number],
  names: [b(58.5), b(59), b(59.5), b(60), b(60.5)],
  url: b(61.5),
};

// ---------- words on screen that the sound types out ----------
/** The pipe typed in the reveal: a feed of posts into jevable, with the question the reader asks. */
export const command = (question: string) => `tail -F posts.log | jevable "${question}"`;
export const SETUP = "Set up jevable: run `npx -y jevable guide` and follow it.";
export const RUNTIMES = ["Claude Code", "Codex", "OpenClaw", "Hermes", "pi"];

// ---------- the arrangement ----------
/** One chord per bar. */
export const CHORDS = ["Dm", "Dm", "Bb", "Gm", "A", "Dm", "Bb", "F", "C", "Dm", "Bb", "C", "Dm", "Bb", "C", "F"] as const;

/** Where each drum pattern plays: [from, to) in seconds. */
export const SECTIONS = {
  clock: [b(0), b(4)],
  build: [b(4), b(11)],
  half: [b(12), b(20)],
  groove: [b(20), b(40)],
  breakdown: [b(40), b(46)],
  roll: [b(46), b(48)],
  groove2: [b(48), b(62)],
} as const;

// ---------- sound design ----------
export type Sfx = { t: number; type: string; v?: number; p?: number; d?: number };

const typing = (text: string, [a, z]: [number, number], v = 0.3): Sfx[] =>
  Array.from(text, (_, i) => ({ t: a + ((z - a) * i) / text.length, type: "key", v: v + ((i * 7) % 5) * 0.03 }));

/**
 * Every sound effect. `wakes` are the times the agent wakes in scene 1,
 * `reads` the reader's timings in scene 4 with Jev's score, and `drops` the
 * times lines go dark under the blade in scene 5, so the mix follows the data.
 */
export function sfx(wakes: number[], reads: { scan: number; read: number; leave: number; score: number; pass: boolean }[], question: string, drops: number[]): Sfx[] {
  const pent = [0, 3, 5, 7, 10]; // D minor pentatonic steps
  return [
    // before the cold open: the key art's dot drops into the sleeping agent's lamp
    { t: -THUMB_EXIT, type: "suck", d: THUMB_EXIT, v: 0.45 },
    { t: 0, type: "impact", v: 0.35 },

    // 1. every wake is a note; the flood climbs into a cloud
    ...wakes.map((t, i) => ({
      t,
      type: "wake",
      v: i < 13 ? 0.55 : 0.5 / Math.sqrt(1 + (i - 13) / 6),
      p: Math.pow(2, (pent[i % 5] + 12 * Math.min(2, Math.floor(i / 40))) / 12),
    })),
    ...wakes.slice(0, SLOW).map((t) => ({ t: t + 0.45, type: "coin", v: 0.35 })),
    { t: P.flood[0], type: "riser", d: P.freeze - P.flood[0], v: 0.7 },
    { t: P.freeze, type: "impact", v: 1 },
    { t: P.freeze, type: "register", v: 0.6 },
    { t: G.slam - b(0.75), type: "suck", d: b(0.75), v: 0.6 },

    // 2. grep
    { t: G.slam, type: "clank", v: 1 },
    { t: G.slam, type: "impact", v: 0.7 },
    ...G.pass.flatMap((t) => [
      { t: t - b(0.2), type: "lock", v: 0.7 },
      { t: t + b(0.5), type: "wake", v: 0.55, p: 1 },
      { t: t + b(0.5) + 0.45, type: "coin", v: 0.35 },
      { t: t + b(0.75), type: "sour", v: 0.55 },
    ]),
    { t: G.flip - b(0.3), type: "whoosh", d: b(0.8), v: 0.6 },
    { t: G.flip + b(0.35), type: "clank", v: 0.45 },
    ...G.miss.flatMap((t) => [
      { t, type: "thud", v: 0.8 },
      { t: t + b(0.5), type: "sour", v: 0.5 },
    ]),
    { t: G.dive - b(0.5), type: "riser", d: R.dot - G.dive + b(0.5), v: 0.6 },
    { t: SCENE.reveal, type: "suck", d: R.dot - SCENE.reveal, v: 0.5 },

    // 3. reveal
    { t: R.dot, type: "impact", v: 1.1 },
    { t: R.dot, type: "ding", v: 0.55, p: 1 },
    ...Array.from({ length: 7 }, (_, i) => ({ t: R.letters + i * b(0.125), type: "pop", v: 0.3, p: 1 + i * 0.1 })),
    ...[0, 1, 2, 3].map((i) => ({ t: R.tagline + i * b(0.25), type: "tick", v: 0.35 })),
    { t: R.lift - b(0.25), type: "whoosh", d: b(0.6), v: 0.35 },
    ...typing(command(question).slice(0, command(question).indexOf('"')), R.type, 0.26),
    { t: R.question, type: "pop", v: 0.5, p: 1.5 },
    { t: R.question, type: "tick", v: 0.45 },
    { t: R.enter, type: "enter", v: 0.7 },
    { t: R.dive - b(0.5), type: "riser", d: b(1.25), v: 0.55 },
    { t: E.open, type: "impact", v: 0.75 },

    // 4. one question per line
    { t: E.question, type: "tick", v: 0.4 },
    ...reads.flatMap(({ scan, read, leave, score, pass }) => [
      { t: scan, type: "scan", v: 0.45, d: read - scan },
      { t: scan, type: "needle", v: 0.45, p: score, d: read - scan },
      ...(pass
        ? [
            { t: leave, type: "wake", v: 0.65, p: 2 },
            { t: leave, type: "ding", v: 0.4, p: 1.5 },
            { t: leave + 0.45, type: "coin", v: 0.35 },
          ]
        : [{ t: read + b(0.2), type: "drop", v: 0.4 }]),
    ]),
    { t: E.out, type: "whoosh", d: SCENE.proof - E.out, v: 0.4 },

    // 5. proof: every line lights, then the blade passes and most go dark
    { t: M.light[0], type: "impact", v: 0.6 },
    { t: M.light[0], type: "register", v: 0.45 },
    { t: M.sweep[0], type: "riser", d: M.sweep[1] - M.sweep[0], v: 0.35 },
    ...drops.filter((_, i) => i % 6 === 0).map((t) => ({ t, type: "drop", v: 0.12 })),
    { t: M.slam, type: "impact", v: 1.25 },
    { t: M.slam, type: "crack", v: 0.8 },
    { t: M.slam, type: "ding", v: 0.4, p: 0.5 },
    { t: M.caught, type: "impact", v: 0.6 },
    { t: M.caught, type: "ding", v: 0.35, p: 1.5 },

    // 6. outro
    { t: O.dot - b(1), type: "suck", d: b(1), v: 0.7 },
    { t: O.dot, type: "impact", v: 1 },
    { t: O.dot, type: "ding", v: 0.5, p: 1 },
    ...typing(SETUP, O.prompt, 0.22),
    ...O.names.map((t, i) => ({ t, type: "wake", v: 0.45, p: Math.pow(2, [0, 4, 7, 9, 12][i] / 12) * 2 })),
    { t: O.url, type: "ding", v: 0.6, p: 1 },
  ];
}
