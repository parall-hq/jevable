import React from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from "remotion";
import { FPS, PRE, R, SCENE, THUMB_EXIT } from "./cues";
import { C, amber } from "./lib/brand";
import { EASE, lerp, ramp } from "./lib/anim";
import { Grain, Vignette, full, lerpColor } from "./lib/ui";
import { Problem, lightOnScreen } from "./scenes/Problem";
import { Grep } from "./scenes/Grep";
import { Reveal, revealDot } from "./scenes/Reveal";
import { Engine } from "./scenes/Engine";
import { Proof } from "./scenes/Proof";
import { Outro } from "./scenes/Outro";

const SCENES: { at: number; C: React.FC<{ t: number }> }[] = [
  { at: SCENE.problem, C: Problem },
  { at: SCENE.grep, C: Grep },
  { at: SCENE.reveal, C: Reveal },
  { at: SCENE.engine, C: Engine },
  { at: SCENE.proof, C: Proof },
  { at: SCENE.outro, C: Outro },
];

export const Reel: React.FC = () => {
  const frame = useCurrentFrame();
  // Scenes take time from the cold open; the key art holds before it.
  const t = frame / FPS - PRE;
  const Scene = [...SCENES].reverse().find((s) => t >= s.at)?.C ?? Problem;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Audio src={staticFile("music.wav")} />
      {t < 0 ? <Thumb exit={ramp(t, -THUMB_EXIT, 0, EASE.inOut)} /> : <Scene t={t} />}
      <Vignette />
      <Grain frame={frame} />
    </AbsoluteFill>
  );
};

/**
 * Feeds thumbnail an early frame, so the video opens on the finished reveal.
 * Then everything but jevable's dot fades, and the dot drops into the
 * waiting session's status light, where the cold open begins.
 */
const Thumb: React.FC<{ exit: number }> = ({ exit }) => {
  const from = revealDot(R.thumb),
    to = lightOnScreen(0);
  const x = lerp(from.x, to.x, exit),
    y = lerp(from.y, to.y, exit),
    r = lerp(from.r, to.r, exit);
  const dark = ramp(exit, 0.6, 1);
  return (
    <>
      <div style={{ ...full, opacity: 1 - ramp(exit, 0, 0.5) }}>
        <Reveal t={R.thumb} />
      </div>
      {exit > 0 && (
        <div
          style={{
            position: "absolute",
            left: x - r,
            top: y - r,
            width: 2 * r,
            height: 2 * r,
            borderRadius: "50%",
            background: lerpColor(C.wake, "#26262b", dark),
            boxShadow: `0 0 ${r * 2}px ${amber(0.8 * (1 - dark))}`,
          }}
        />
      )}
    </>
  );
};
