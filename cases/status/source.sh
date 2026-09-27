#!/usr/bin/env bash
# Incidents on the Claude and OpenAI status pages, one per line:
# {"page", "id", "name", "status", "latest"}; latest is the newest update.
set -euo pipefail
for page in status.claude.com status.openai.com; do
  curl -fsS "https://$page/api/v2/incidents.json" |
    jq -c --arg page "$page" '.incidents[] | {page: $page, id, name, status, latest: .incident_updates[0].body}'
done
