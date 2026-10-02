# jevable

**Make your monitor smart.** An agent watching a log, a feed or an API pays a
full turn for every line that wakes it, or misses what a grep did not foresee.
jevable is grep that reads meaning: [Jev](https://docs.typesafe.ai), TypeSafe's
fast and cheap classification model, judges each line in about 0.3 s for about
$0.00002, and only what matters wakes the agent. Measured on 334 real events:
7.3× fewer wakes than waking on every event, 85% of what mattered caught where
a keyword alert caught 25% ([jevable.sh/bench](https://jevable.sh/bench)).

```sh
npx -y jevable key <an API key from TypeSafe, OpenRouter or Vercel AI Gateway>

tail -n 0 -F app.log | npx -y jevable "Does this line report that a dependency is down?"
gh issue list --json number,title,body | jq -c '.[]' | npx -y jevable --on .body "Is this a bug report about login?"
git log --oneline -200 | npx -y jevable "Does this commit change a public API?"
```

Like grep: lines pass through unchanged, `-v` inverts, exit status 0 when
something passed. `--on .field` judges a field of JSON lines (a jq path),
`-t 0.8` raises the threshold, `--json` adds the score. Do the exact part with
grep or jq first; jevable only needs to see what is left.

## One prompt

Paste this into Claude Code, Codex, OpenClaw, Hermes, pi, dsh or any agent
that runs shell commands:

```
Set up jevable: run `npx -y jevable guide` and follow it.
```

It asks you once for an API key (TypeSafe, OpenRouter or Vercel AI Gateway),
adds a note to your AGENTS.md or CLAUDE.md so it reaches for jevable on its own,
shows it working, and asks what to watch. Or put the job in front:
"<What to watch, and what should happen when it matters.> Set it up with
jevable: run `npx -y jevable guide` and follow it."

## Commands

- `jevable QUESTION` — print the lines for which the answer is yes. `--on`, `-t`, `-v`, `--json`, `--all`, `-m`, `--from`, `--key`, `--cooldown`, `--state`.
- `jevable filter RULE` — the same with a CEL rule: plain conditions, several `judge.*` questions, choices, scores, `--window`.
- `jevable test QUESTION --yes ... --no ...` — run a question (or `--rule`) on samples, show the scores and the thresholds that separate them.
- `jevable key [KEY]` — whether there is a working key for Jev; given a key, tell whose it is, check it and save it.
- `jevable guide` — when to reach for it, how to ask and test, rules, watching a stream ([guide.md](guide.md)).

## As a library

```ts
import { Client, Engine } from "jevable"; // or @jevable/core, the engine alone

const engine = new Engine(new Client({ apiKey: process.env.TYPESAFE_API_KEY }));
const rule = engine.compile(`judge.boolean(line, "Does this report a production outage?") >= 0.7`);
const { pass, calls } = await rule.match({ line: "checkout returns 500 for every order" });
```

[MIT](https://github.com/parall-hq/jevable/blob/main/LICENSE) · [Source](https://github.com/parall-hq/jevable) · [jevable.sh](https://jevable.sh)
