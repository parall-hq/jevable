# Decision models on the same events

jevable asks any decision model that speaks TypeSafe's System One API
(`jevable model`). This replays the benchmark's 334 blind-labelled fresh
events (`bench/fresh/`, 52 that matter) through each model, with the same
rules and thresholds, the ones tuned on Jev, the way a person would switch
models without re-tuning. A model can answer a little differently from one run
to the next, so each one is replayed three times.

| model | via | runs | caught (of 52) | needless wakes | agent turns | questions | model $ | total $ (agent + model) | median per question |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| @cf/cloudflare/clef-flash | Cloudflare Workers AI | 3 | 46 | 1 | 47 | 208 | $0.0076 | $5.56 | 266 ms |
| @cf/cloudflare/clef | Cloudflare Workers AI | 3 | 45 | 0 | 45 | 208 | $0.02 | $5.34 | 458 ms |
| jev-1.13.0 | TypeSafe | 3 | 45.0 (44–46) | 1 | 46.0 (45–47) | 208 | $0.0050 | $5.44 | 106 ms |

Replayed 2026-10-03. A range is the lowest and highest of the runs; a single
number means every run agreed.

What it shows:

- **The models catch about the same.** Jev varies by a couple of events from
  run to run (44–46), and the Clef models fall inside that range. Clef answered
  identically in every run.
- **Most misses are the rules', not the models'.** Five events are missed by
  every model: two status titles worded "Service disruption on Claude …", two
  Hacker News comments and a terse review ask ("ditto. tests are trivial …").
  Each model misses one or two more of its own. Rewording a rule moved more
  (13 → 8 misses, see `bench/wake/README.md`) than switching models does here.
- **The model's bill is a rounding error.** Every model costs under 2 cents for
  the 334 events, while the agent turns it lets through cost about $5.40.
  What a model catches and lets through decides the cost, not its price per
  token.
- **Speed differs most.** These are median round trips for a single question,
  network included, from one machine in Asia, one call at a time. Compare them
  with each other, not with the providers' published figures.

Not here yet: Liquid d1, Upstage Solar Decide, Inception Mercury Decide and Kev
(OpenRouter), and Laya (Vercel AI Gateway). Any model jevable can ask can be
added with one more folder of runs.

## Rerunning

```sh
# one run of one model into bench/models/<model>/<run>.json; JEV_PROVIDER picks whose key is used
JEV_PROVIDER=cloudflare node --conditions=jevable-source bench/wake/replay.ts --fresh --model @cf/cloudflare/clef --out bench/models/cf-clef/1.json
node --conditions=jevable-source bench/models/compare.ts    # the table above
```

Model prices are the providers' list prices per million input tokens
(`PRICE` in `compare.ts`); the agent's cost per wake is the measured one from
`bench/wake/agent-runs/`, as on [jevable.sh/bench](https://jevable.sh/bench).
