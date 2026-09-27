#!/usr/bin/env bash
# Newest Hacker News comments matching a query (default: claude code), one per
# line: {"id", "author", "text"} with the HTML stripped.
set -euo pipefail
query=$(jq -rn --arg q "${1:-claude code}" '$q | @uri')
curl -fsS "https://hn.algolia.com/api/v1/search_by_date?tags=comment&hitsPerPage=100&query=$query" |
  jq -c '.hits[] | {id: .objectID, author, text: (.comment_text // ""
    | gsub("<[^>]+>"; " ") | gsub("&quot;"; "\"") | gsub("&#x27;"; "'"'"'")
    | gsub("&gt;"; ">") | gsub("&lt;"; "<") | gsub("&amp;"; "&"))}'
