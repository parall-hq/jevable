import React from "react";
import { Composition, Still } from "remotion";
import { DURATION, FPS, PRE } from "./cues";
import { Reel } from "./Reel";
import { Poster, Og } from "./scenes/Poster";

export const Root: React.FC = () => (
  <>
    <Composition id="Reel" component={Reel} durationInFrames={Math.round((PRE + DURATION) * FPS)} fps={FPS} width={1920} height={1080} />
    <Still id="Poster" component={Poster} width={1920} height={1080} />
    <Still id="Og" component={Og} width={1200} height={630} />
  </>
);
