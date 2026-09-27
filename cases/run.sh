#!/usr/bin/env bash
# Runs every case, or the ones named: `jevable test` on its samples, then, if it
# has a source.sh, `jevable filter` on live data. Needs TYPESAFE_API_KEY (and
# GITHUB_TOKEN helps with GitHub's rate limit). JEVABLE picks the jevable to run;
# the default is this checkout's sources.
set -euo pipefail
cd "$(dirname "$0")"
root=$(cd .. && pwd)
jevable() { ${JEVABLE:-node --conditions=jevable-source "$root/packages/cli/src/cli.ts"} "$@"; }
for c in ${@:-$(ls -d */ | tr -d /)}; do
  echo "## $c"
  (cd "$c" && jevable test -f rule.cel --yes yes.txt --no no.txt) || true
  if [ -x "$c/source.sh" ]; then
    echo "-- live: $c/source.sh | jevable filter --json -f rule.cel"
    "./$c/source.sh" | (cd "$c" && jevable filter --json -f rule.cel) || true
  fi
  echo
done
