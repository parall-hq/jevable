# Launch video

jevable's 30-second launch video, made in code with
[Remotion](https://www.remotion.dev). The soundtrack is synthesized in code
too: no samples, stock music or plugins. The shot list is in
[SHOTS.md](SHOTS.md).

```sh
npm install
npm run studio        # scrub the timeline in a browser (renders the music first)
npm run music         # public/music.wav, from the cue sheet
npm run render        # music, then out/jevable-launch.mp4 (1920×1080, 60 fps, H.264, 320k AAC)
npm run poster        # out/poster.png (README cover) and out/og.png (1200×630 link preview)
npm run check-types
sh scripts/contact-sheets.sh out/jevable-launch.mp4   # one sheet per shot, in out/sheets/
```

A standalone npm project, outside the repo's workspaces, so nothing else
depends on Remotion. Renders (`out/`) and the generated music are not
committed.

## Timing lives in one place

[`src/cues.ts`](src/cues.ts) holds every time in the piece: the tempo (128
BPM, 16 bars = 30 s), when each shot starts, and every event inside a shot.
The scenes read their animation from it, and
[`scripts/music.ts`](scripts/music.ts) reads the same cues to place every
kick, riser, impact and sound effect, so moving a cue moves picture and
sound together. Scenes take absolute time `t` in seconds, not frames, so cue
values stay literal. Some cues follow the data: the 334 wakes in the first
shot, the needle readings in the fourth and the lines going dark in the
fifth come from the repo's files, and picture and sound compute them with
the same functions (`arrivals`, `readerTimes`, `sweepAt`).

The video opens on a 0.5 s hold of the finished reveal (`PRE`, `R.thumb`),
because feeds use an early frame as the thumbnail; its dot then drops into
the sleeping agent's lamp. The music covers that hold too.

The mix cannot be heard in review. `npm run music` prints its integrated
loudness (target −13 LUFS, BS.1770) and peak; check the render with
`ffmpeg -i out/jevable-launch.mp4 -filter_complex ebur128=peak=true -f null -`
and look at structure with `showspectrumpic`.

## Claims

Every number on screen is computed, not typed:
[`src/story.ts`](src/story.ts) runs the benchmark's own arithmetic
(`bench/wake/tally.ts`, as jevable.sh/bench does) over
`bench/wake/fresh-results.json` and `bench/wake/agent-runs/`, and reads the
demo events (`packages/web/src/data/demo.json`) and keyword alerts
(`bench/wake/keywords.json`). It throws if a card would misstate its data (a
"needless wake" that was not one, a score that disagrees with its verdict).

The proof shot carries one line of small print (the sample, blind labels, and
jevable's 8 misses with where they are listed); the rest of the disclosure
lives here. What the video states, and what must stay with it:

- **7.3× fewer agent wakes**: 334 wakes (every event) against 46 (jevable),
  on 334 fresh events from 5 live sources, never used to write any rule and
  labelled blind; 52 of them mattered.
- **85% of what mattered caught**, against 25% for a keyword alert. jevable
  still missed 8 of 52, all listed on jevable.sh/bench. Do not claim "no
  misses" or "same catch rate".
- **$39.49 vs $5.44**: agent turns × the mean measured cost of one wake, $0.12
  (Claude Code, fresh session, n = 8); jevable's total includes $0.005 of
  Jev. Real sessions cost more per wake than a fresh one.
- **Jev's scores** in the fourth shot are the recorded answers for those
  posts to the reset rule's question (shown whole, never paraphrased); the
  grep shot uses the post and status titles whose keyword alert woke
  needlessly or missed. The posts are @thsottiaux's, as on jevable.sh's demo.
- **~0.3 s and ~$0.00002 a line** are the README's figures; the second is
  recomputed from the demo runs as jevable.sh does. Plain rule conditions
  settled some events without a question, so the fresh run asked Jev 208
  questions for 334 events.
- **The agent** is drawn as a Claude Code session because the wakes were
  priced on Claude Code; its replies ("Not relevant.", "Codex limits were
  reset. Letting you know.") illustrate a turn and are not quotes. The
  measured runs in `bench/wake/agent-runs/` hold the real ones.

Keep the small print and this disclosure if the numbers change.
