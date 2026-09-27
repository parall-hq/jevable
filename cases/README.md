# Cases

Real self-trigger scenarios, each a rule plus samples it must get right, and
(where the data is public) a `source.sh` that fetches live events. They check
that `jevable` and the writing advice in `jevable guide` hold up on real data.

```bash
export OPENROUTER_API_KEY=... GITHUB_TOKEN=$(gh auth token)   # any Jev provider (jevable providers); GitHub token only for the rate limit
cases/run.sh                  # every case
cases/run.sh releases tibo    # some
JEVABLE="npx -y jevable" cases/run.sh   # against the published package
```

Each case: `rule.cel`, `yes.txt` / `no.txt` (labelled before the first run and
not changed after), and `source.sh` printing one JSON event per line.

| Case | Wake when | Source | Samples | Live run (2026-09-25) |
| --- | --- | --- | --- | --- |
| `tibo` | Tibo announces a Codex usage-limit reset (not a teaser, not a pun) | X — no timeline without a login; samples are his real posts (single posts via `api.fxtwitter.com/status/<id>`) | 16/16, yes 0.88–1.00 · no 0.00–0.04, incl. the "little surprise tomorrow" teaser and the "reseting" misspelling | — |
| `status` | a resolved incident on the Claude or OpenAI status page touched a model, the API or a developer tool | Statuspage JSON | 14/14, yes 0.87–0.98 · no 0.04–0.16 | 34 of 75 incidents; 4 decided by the word `API` alone |
| `hn-problems` | a Hacker News comment reports a problem with Claude Code | HN Algolia API | 10/10, yes 0.87–0.96 · no 0.02–0.24 | 10 of 100; 59 never asked (no mention of Claude Code) |
| `regressions` | a new issue says something that used to work broke | GitHub issues (anthropics/claude-code) | 11/11, yes 0.94–0.99 · no 0.01–0.09 | 9 of 100, all real regressions; 4 decided by the issue template alone |
| `releases` | a dependency release needs code changes or fixes a vulnerability | GitHub releases (vercel/ai, prisma, hono) | 11/11 | 12 of 30: every breaking prisma RC, both hono security releases, the prisma "secures Studio" release; no patch release |
| `review-asks` | a human reviewer asks for a code change | GitHub PR review comments (vercel/next.js) | 11/11, yes 0.80–0.98 · no 0.04–0.27 | 23 of 100; 61 bot comments never asked |

What the runs taught, now in `jevable guide`:

- **Say what counts, including the edge.** First drafts missed "annoying
  behavior" (hn-problems), plain instructions like "run this after X"
  (review-asks) and "back in a few minutes" (tibo); naming them in the
  criteria moved those samples from 0.4–0.6 to above 0.8.
- **Ask what the text names, not what it implies.** "Does this incident affect
  developers?" left every model incident at 0.55–0.69; "does the title name a
  model, the API or a developer tool?" split the samples 0.87+ against 0.16−.
- **Markers are plain conditions.** A filled-in issue template, a
  ```` ```suggestion ```` block, the word `API`: `json.body.contains(...) ||
  judge...` catches what Jev scored low and saves the call.
- **Leave room around the threshold.** The same title scored 0.36–0.45 over
  five calls; pick the threshold inside the gap `jevable test` reports.
