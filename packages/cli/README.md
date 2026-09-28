# jevable

**grep that reads meaning.** Pipe lines in, ask a yes/no question, get back
the lines where the answer is yes. [Jev](https://docs.typesafe.ai), TypeSafe's
fast and cheap classification model, reads each line in about 0.3 s for about
$0.00002 — so your agent does not have to read them all.

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

## Teach your agent

Add this to your AGENTS.md or CLAUDE.md:

```
When you would read many things — logs, issues, comments, commits, search
results — to find the few that matter, pipe them through jevable first:
`... | npx -y jevable "<a yes/no question>"`, and read only what passes.
Run `npx -y jevable guide` once for how to ask, test and watch.
```

Or hand it one job: "<What to watch, and what should happen when it matters.>
Set it up with jevable: run `npx -y jevable guide` and follow it."

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
