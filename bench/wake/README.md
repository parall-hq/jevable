# Wake bench: what it costs an agent to watch a stream

When an agent has to react to events in a stream, how many agent turns (and
dollars) does each way of watching cost, and how many events that matter
does it miss or wake for needlessly?

Measured 2026-09-28 on the labelled samples in `cases/`, with real Jev
answers and real Claude Code wakes.

## Headline candidates

All from the held-out slice (130 events the rules were never tuned on, 46 of
them matter):

1. **3.3× fewer agent turns than waking on every event (39 vs 130), with 1
   needless wake instead of 84 — at the cost of 8 missed events out of 46.**
2. **About as many wakes as a keyword alert (39 vs 32), but a third of the
   misses: 8 of 46 events that matter vs 23.** The keyword alert catches half
   of what matters; jevable catches 83%.
3. **Every needless wake is a full agent turn: $0.10 on Claude Code (measured,
   fresh session). Filtering the whole held-out stream through Jev cost
   $0.003.** Agent spend drops from $15.37 to $4.61 (about 3× less; 2.9× when
   an idle wake is priced below one that acts, see below).

Do not claim "same catch rate" or "no misses": waking on every event misses
nothing, and jevable missed 17% of held-out events that mattered.

## Method

Each case in `cases/` becomes one stream: its labelled samples (`yes.txt`,
`no.txt`, and where present `holdout-yes.txt`, `holdout-no.txt`) interleaved
in a fixed hash order (the same order the landing page demo uses). Four ways
of watching are replayed over each stream:

| way of watching | agent turns | missed | needless wakes |
| --- | --- | --- | --- |
| **every event** wakes the agent (e.g. Claude Code's Monitor with no filter) | one per event | 0 | events that do not matter |
| **keyword alert**: a regex in front, run case-insensitive over the raw event line | one per match | events that matter with no match | matches that do not matter |
| **heartbeat every 30 min** (OpenClaw's default) | 48 a day, whatever happens | 0 (it reads everything) | checks with nothing that matters since the last one |
| **jevable** in front: the case's `rule.cel` with real Jev answers | one per pass | events that matter that did not pass | passes that do not matter |

"Matters" means the event's label (`yes` files). The agent is assumed to
handle every event it is woken for correctly; the measured wakes below
support that (it got all 38 events it was shown right).

Dollars = agent turns × measured cost of one wake (a single-event wake for
every event, keyword alert and jevable; a ~10-event wake for the heartbeat),
plus Jev at $0.042 per million input tokens for jevable. A second column
prices each turn by what it does: a wake that acts on an event that matters
($0.13) costs more than one that decides to do nothing ($0.10).

Two slices: **held-out only** (the honest one: the rules were tuned on
`yes.txt`/`no.txt`; tibo has no held-out samples, so this slice has 5 cases)
and **all samples**.

### Assumptions

- **Each case's events arrive spread evenly over one day.** This only matters
  for the heartbeat: 48 checks a day, each reading what arrived in the 30
  minutes before it. The streams here have 16–43 events, so most checks find
  nothing and the heartbeat costs more turns than waking on every event. It
  only needs fewer turns than "every event" above 48 events a day. Its
  detection delay is up to 30 minutes (15 on average); the other three wake
  within seconds.
- **The samples are not a natural stream.** 35% of held-out events matter,
  and many of the rest are deliberate near misses. In the live runs in
  `cases/README.md` far fewer events passed (HN: 10 of 100 comments, issues:
  9 of 100), so the gap between "every event" and a filter is larger there.
  Those live runs are unlabelled, so they give no miss count and are not used
  here.
- **Jev questions are nearly one per event here** (121 for 130) because the
  samples were chosen to contain the words that reach the judge. In live
  streams the plain conditions decide more events without asking Jev (59 of
  100 HN comments never reached Jev). Jev cost is negligible either way.
- **One Jev run.** Scores close to a rule's threshold can move between runs
  (see `cases/README.md`); three of jevable's eight misses scored 0.46–0.67
  against a 0.7 threshold.

### Keyword regexes (chosen before any results)

Written into `keywords.json` before any result was seen, and before reading
the samples of hn-problems, releases and review-asks; not tuned afterwards.
tibo, status and regressions reuse the alerts in
`packages/web/scripts/demo-data.ts`.

| case | regex (case-insensitive, raw event line) |
| --- | --- |
| tibo | `reset` |
| status | `\bapi\b` |
| hn-problems | `claude code` and then `bug\|error\|broken\|crash\|fail\|issue\|problem` (two chained greps, one regex with lookaheads in the file) |
| regressions | `regression\|used to work\|no longer\|stopped working` |
| releases | `breaking\|security\|vulnerab\|cve` |
| review-asks | `suggestion\|please\|could you\|can you\|should\|\bnit\b` |

## What one agent wake costs (measured)

`claude -p --output-format json --permission-mode acceptEdits` (Claude Code
2.1.283, default model **claude-opus-5-5[1m]**, default effort) in an empty
temp directory, with the calling session's `CLAUDE*` variables removed so it
runs as from a plain shell. The prompt is a short watcher brief ("You are
watching <source> for <goal>. If this event matters, append one line to
notify.log saying why; otherwise do nothing.") plus one event, or plus the 10
events since the last check for the heartbeat runs. Events come from the
held-out samples (tibo: its samples).

| run | events (matter) | cost | duration | input tokens (cache read / cache write / new) | output | wrote notify.log |
| --- | --- | --- | --- | --- | --- | --- |
| 01-single-tibo | 1 (1) | $0.12 | 7.2 s | 33436 / 13229 / 4 | 332 | 1 line |
| 02-single-status | 1 (0) | $0.10 | 3.6 s | 10234 / 11367 / 2 | 203 | no |
| 03-single-hn-problems | 1 (1) | $0.13 | 8.8 s | 33679 / 13754 / 4 | 621 | 1 line |
| 04-single-hn-problems | 1 (0) | $0.11 | 5.6 s | 10234 / 13025 / 2 | 396 | no |
| 05-single-regressions | 1 (0) | $0.10 | 4.3 s | 10234 / 12428 / 2 | 166 | no |
| 06-single-releases | 1 (1) | $0.16 | 20.9 s | 59675 / 15585 / 6 | 1369 | 1 line |
| 07-single-review-asks | 1 (1) | $0.12 | 6.6 s | 31818 / 13464 / 4 | 367 | 1 line |
| 08-single-review-asks | 1 (0) | $0.10 | 3.2 s | 10234 / 11362 / 2 | 152 | no |
| 09-batch-status | 10 (6) | $0.17 | 19.9 s | 58584 / 15429 / 6 | 1906 | 6 lines |
| 10-batch-hn-problems | 10 (2) | $0.17 | 17.4 s | 34526 / 16981 / 4 | 1494 | 2 lines |
| 11-batch-review-asks | 10 (7) | $0.15 | 18.0 s | 33973 / 14628 / 4 | 1548 | 7 lines |

- **Single-event wake: $0.12 on average** (n=8, $0.10–$0.16, 7.5 s). Acting
  on an event that matters: $0.13; deciding to do nothing: $0.10.
- **Heartbeat wake reading ~10 events: $0.17 on average** (n=3, $0.15–$0.17,
  18 s).
- Most of the cost is Claude Code itself: every fresh wake reads 10–60k
  tokens of system prompt, tools and user instructions (mostly from cache)
  and writes 11–17k to cache, whatever the event says.
- Costs are Claude Code's own `total_cost_usd` at API list prices. On a
  subscription the same turns count against usage limits instead.
- **These are the cheapest wakes an agent gets.** A fresh `claude -p` starts
  from an empty session. In a real long-running session each wake also
  re-reads that session's context, so every turn costs more than measured
  here. The numbers below are not adjusted for that.
- The agent judged every event it was shown correctly: 8/8 single events,
  and in each batch it wrote exactly the lines for the events that matter,
  including three that Jev missed ("Elevated errors across all models",
  "... multiple models", "stage? maybe write?"). jevable's misses are the
  filter's, not the agent's.

## Results: held-out samples only

5 cases, 130 events, 46 that matter. Each case is one day's stream.

| way of watching | agent turns | missed (of 46) | needless wakes | Jev questions | Jev tokens | Jev $ | agent $ (mean wake) | total $ | total $ (acting / idle wake) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| every event | 130 | 0 | 84 | – | – | – | $15.37 | $15.37 | $14.79 |
| keyword alert | 32 | 23 | 9 | – | – | – | $3.78 | $3.78 | $4.00 |
| heartbeat 30 min | 240 | 0 | 194 | – | – | – | $40.06 | $40.06 | $26.12 |
| jevable | 39 | 8 | 1 | 121 | 66119 | $0.0028 | $4.61 | $4.61 | $5.18 |

Per case: agent turns / missed / needless wakes.

| case | events (matter) | every event | keyword alert | heartbeat 30 min | jevable | Jev questions / tokens |
| --- | --- | --- | --- | --- | --- | --- |
| status | 26 (12) | 26 / 0 / 14 | 1 / 11 / 0 | 48 / 0 / 36 | 8 / 4 / 0 | 25 / 9638 |
| hn-problems | 29 (3) | 29 / 0 / 26 | 8 / 1 / 6 | 48 / 0 / 45 | 4 / 0 / 1 | 29 / 15538 |
| regressions | 24 (5) | 24 / 0 / 19 | 6 / 1 / 2 | 48 / 0 / 43 | 5 / 0 / 0 | 20 / 16557 |
| releases | 19 (7) | 19 / 0 / 12 | 7 / 0 / 0 | 48 / 0 / 41 | 7 / 0 / 0 | 19 / 13489 |
| review-asks | 32 (19) | 32 / 0 / 13 | 10 / 10 / 1 | 48 / 0 / 29 | 15 / 4 / 0 | 28 / 10897 |

## Results: all samples (tuned + held-out)

6 cases, 203 events, 80 that matter. The rules were tuned on 73 of these
events, so this slice flatters jevable; on the tuned events alone it made no
mistakes.

| way of watching | agent turns | missed (of 80) | needless wakes | Jev questions | Jev tokens | Jev $ | agent $ (mean wake) | total $ | total $ (acting / idle wake) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| every event | 203 | 0 | 123 | – | – | – | $24.00 | $24.00 | $23.35 |
| keyword alert | 58 | 36 | 14 | – | – | – | $6.86 | $6.86 | $7.31 |
| heartbeat 30 min | 288 | 0 | 208 | – | – | – | $48.07 | $48.07 | $32.10 |
| jevable | 73 | 8 | 1 | 189 | 101807 | $0.0043 | $8.63 | $8.64 | $9.72 |

| case | events (matter) | every event | keyword alert | heartbeat 30 min | jevable | Jev questions / tokens |
| --- | --- | --- | --- | --- | --- | --- |
| tibo | 16 (9) | 16 / 0 / 7 | 12 / 0 / 3 | 48 / 0 / 39 | 9 / 0 / 0 | 16 / 7195 |
| status | 40 (19) | 40 / 0 / 21 | 5 / 14 / 0 | 48 / 0 / 29 | 15 / 4 / 0 | 35 / 13471 |
| hn-problems | 39 (6) | 39 / 0 / 33 | 9 / 4 / 7 | 48 / 0 / 42 | 7 / 0 / 1 | 39 / 19566 |
| regressions | 35 (9) | 35 / 0 / 26 | 8 / 3 / 2 | 48 / 0 / 39 | 9 / 0 / 0 | 31 / 25506 |
| releases | 30 (12) | 30 / 0 / 18 | 12 / 0 / 0 | 48 / 0 / 36 | 12 / 0 / 0 | 30 / 21371 |
| review-asks | 43 (25) | 43 / 0 / 18 | 12 / 15 / 2 | 48 / 0 / 23 | 21 / 4 / 0 | 38 / 14698 |

## Where jevable gets it wrong (held-out)

**8 missed events**, in two cases:

- **status, 4 of 12.** Three titles say "models" without naming one:
  "Elevated errors across all models" (Jev 0.11), "Elevated errors for
  multiple models" (0.10), "Elevated errors on requests to multiple models"
  (0.13). One names the developer platform by its domain: "Degraded
  performance on platform.claude.com and Claude for Microsoft Office 365"
  (0.15). The rule asks whether the title *names* a model, the API or a
  developer tool, and Jev read "all models" as naming none. This is a gap in
  the rule's wording, which the held-out set was meant to find. It was left
  as is here.
- **review-asks, 4 of 19.** Short or hedged asks: "drop a comemnt about this"
  after a GIF (0.18), "stage? maybe write?" (0.46), "Maybe to keep
  consistency, we can call this one a `known security vulnerability`" (0.50),
  "these two sections are maybe not 'examples' … could go in a different
  section" (0.67). Three sit just under the 0.7 threshold.

**1 needless wake**: an HN comment (hn-problems) that mentions Claude Code
next to a GNOME update breaking GDM, scored 0.78.

On the tuned samples jevable made no mistakes, as expected.

The keyword alert does worse: `\bapi\b` caught 1 of 12 status incidents that
matter, and the review-asks regex caught 9 of 19 asks while waking once for a
reviewer's explanation that asked for nothing ("we can (and therefore
should) preserve it"). On dollars, though, a keyword alert is the cheapest of the four
($3.78 vs jevable's $4.61), because jevable wakes the agent for more of the
events that matter. jevable's case against a keyword alert is what it catches
(38 vs 23 of 46), not the price.

## Spend

- Agent runs: $1.45 for the 11 runs saved in `agent-runs/`, plus $0.13 for
  one earlier trial run that was not saved: **$1.58**.
- Jev: 189 questions, 101,807 tokens: **$0.0043**.

## Files and rerunning

- `keywords.json`: the keyword alerts, written before any result.
- `cases.ts`: the cases as streams, and each watcher's source and goal.
- `replay.ts`: runs every event through the keyword alert and through jevable
  (real Jev) and writes `results.json` (per event: label, slice, keyword hit,
  jevable pass, Jev questions, tokens, scores).
- `agent.ts`: the measured Claude Code wakes; one JSON file per run in
  `agent-runs/` (Claude Code's output and what it wrote to `notify.log`).
  Stops before total spend could pass $4.
- `report.ts`: prints the tables above from `results.json` and `agent-runs/`.

```bash
TYPESAFE_API_KEY=... node --conditions=jevable-source bench/wake/replay.ts
node --conditions=jevable-source bench/wake/agent.ts    # spends about $1.50
node --conditions=jevable-source bench/wake/report.ts
```

## Fresh events, after rewording two rules (2026-09-28)

The held-out misses above came mostly from how two rules were worded (Jev reads
criteria literally). We reworded `cases/status/rule.cel` and
`cases/review-asks/rule.cel` (generic mentions such as "all models", the names a
thing goes by such as platform.claude.com, tentative requests), kept the rules
as they were in `bench/fresh/rules-before/`, then fetched new events from the
five live sources — none used to write any rule — into `bench/fresh/*.jsonl`.
A separate agent labelled them seeing only each case's goal, never the rules or
any score (`bench/fresh/labels.json`; the ones it was unsure about are left out).
jevable.sh/bench renders these results from the same files with `tally.ts`.

```sh
node --conditions=jevable-source bench/wake/replay.ts --fresh    # needs a Jev key
node --conditions=jevable-source bench/wake/report.ts fresh-results.json
```

### Fresh events, labelled blind (fetched after the rules were revised; never used to write any rule)

5 cases, 334 events, 52 that matter. Each case is one day's stream.

| way of watching | agent turns | missed (of 52) | needless wakes | Jev questions | Jev tokens | Jev $ | agent $ (mean wake) | total $ | total $ (acting / idle wake) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| every event | 334 | 0 | 282 | – | – | – | $39.49 | $39.49 | $35.99 |
| keyword alert | 52 | 39 | 39 | – | – | – | $6.15 | $6.15 | $5.75 |
| heartbeat 30 min | 240 | 0 | 189 | – | – | – | $40.06 | $40.06 | $26.27 |
| jevable, rules before | 41 | 13 | 2 | 208 | 116512 | $0.0049 | $4.85 | $4.85 | $5.42 |
| jevable | 46 | 8 | 2 | 208 | 118564 | $0.0050 | $5.44 | $5.44 | $6.08 |

Per case: agent turns / missed / needless wakes.

| case | events (matter) | every event | keyword alert | heartbeat 30 min | jevable, rules before | jevable | Jev questions / tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| status | 35 (30) | 35 / 0 / 5 | 2 / 28 / 0 | 48 / 0 / 18 | 20 / 10 / 0 | 26 / 4 / 0 | 28 / 11696 |
| hn-problems | 91 (7) | 91 / 0 / 84 | 10 / 5 / 8 | 48 / 0 / 41 | 6 / 1 / 0 | 5 / 2 / 0 | 45 / 21149 |
| regressions | 97 (11) | 97 / 0 / 86 | 22 / 4 / 15 | 48 / 0 / 37 | 12 / 1 / 2 | 12 / 1 / 2 | 92 / 66513 |
| releases | 11 (1) | 11 / 0 / 10 | 1 / 0 / 0 | 48 / 0 / 47 | 1 / 0 / 0 | 1 / 0 / 0 | 9 / 4184 |
| review-asks | 100 (3) | 100 / 0 / 97 | 17 / 2 / 16 | 48 / 0 / 46 | 2 / 1 / 0 | 2 / 1 / 0 | 34 / 15022 |

Jev for the whole replay (jev-1.13.0 via TypeSafe): 118564 tokens, $0.0050.
