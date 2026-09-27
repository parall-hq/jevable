#!/usr/bin/env bash
# Newest pull-request review comments of a GitHub repo (default:
# vercel/next.js), one per line: {"id", "user", "body"}.
set -euo pipefail
curl -fsSL ${GITHUB_TOKEN:+-H "Authorization: Bearer $GITHUB_TOKEN"} \
  "https://api.github.com/repos/${1:-vercel/next.js}/pulls/comments?sort=created&direction=desc&per_page=100" |
  jq -c '.[] | {id, user: .user.login, body: .body[:2000]}'
