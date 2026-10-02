#!/bin/sh
# One contact sheet per shot: 12 evenly spaced frames in a 4×3 grid.
#   scripts/contact-sheets.sh out/jevable-launch.mp4 [out/sheets]
# Shot boundaries come from src/cues.ts, so the sheets follow any retiming.
set -e
video=$(cd "$(dirname "${1:?usage: scripts/contact-sheets.sh VIDEO [OUTDIR]}")" && pwd)/$(basename "$1")
mkdir -p "${2:-out/sheets}"
dir=$(cd "${2:-out/sheets}" && pwd)
cd "$(dirname "$0")/.."
node -e '
  import("./src/cues.ts").then(({ SCENE, PRE }) => {
    const shots = [["0-hold", -PRE, 0], ["1-every-line", 0, SCENE.grep], ["2-grep", SCENE.grep, SCENE.reveal], ["3-reveal", SCENE.reveal, SCENE.engine], ["4-jev", SCENE.engine, SCENE.proof], ["5-proof", SCENE.proof, SCENE.outro], ["6-outro", SCENE.outro, SCENE.end]];
    for (const [name, a, z] of shots) console.log(name, (a + PRE).toFixed(3), (z - a).toFixed(3), name === "0-hold" ? 4 : 12);
  });
' | while read -r name start dur n; do
  ffmpeg -nostdin -loglevel error -y -ss "$start" -t "$dur" -i "$video" \
    -vf "fps=$n/$dur,scale=640:-1,tile=4x$(((n + 3) / 4)):padding=4:color=0x303030" -frames:v 1 "$dir/$name.png"
  echo "$dir/$name.png"
done
