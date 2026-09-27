#!/usr/bin/env bash
# Newest open issues of a GitHub repo (default: anthropics/claude-code), one
# per line: {"number", "title", "body"}. Set GITHUB_TOKEN for a higher rate limit.
set -euo pipefail
curl -fsSL ${GITHUB_TOKEN:+-H "Authorization: Bearer $GITHUB_TOKEN"} \
  "https://api.github.com/repos/${1:-anthropics/claude-code}/issues?state=open&per_page=100" |
  jq -c '.[] | select(.pull_request | not) | {number, title, body: ((.body // "")[:3000])}'
