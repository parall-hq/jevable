#!/usr/bin/env bash
# Recent releases of some libraries (default: vercel/ai prisma/prisma
# honojs/hono), one per line: {"repo", "tag", "body"}.
set -euo pipefail
for repo in ${@:-vercel/ai prisma/prisma honojs/hono}; do
  curl -fsSL ${GITHUB_TOKEN:+-H "Authorization: Bearer $GITHUB_TOKEN"} \
    "https://api.github.com/repos/$repo/releases?per_page=10" |
    jq -c --arg repo "$repo" '.[] | {repo: $repo, tag: .tag_name, body: ((.body // "")[:4000])}'
done
