# jevable

Make your monitor smart. An agent watching a log, a feed or an API is woken
by every line, or by a grep that misses what nobody foresaw. `jevable` sits in
between: plain conditions do what grep does, and a question answered by
[Jev](https://docs.typesafe.ai), TypeSafe's fast and cheap classification
model, decides the rest. Only what matters wakes the agent, or reaches you —
and every wake it holds back is an agent turn you do not pay for, while a Jev
question costs about $0.00002.

## One prompt, any agent

Paste this into Claude Code, Codex, OpenClaw, Hermes, pi, dsh or any agent
that runs shell commands, with your own first sentence:

```
<What to watch, and what should happen when it matters.>
Set it up with jevable: run `npx -y jevable guide` and follow it.
```

For example:

- Tell me on my phone when the Claude or OpenAI status page reports an incident that touches the API.
- When a reviewer asks for a change on PR #12 in acme/api, make the change and push it.
- While I work, watch `logs/dev.log` and wake up when a dependency goes down.

The agent writes the rule, tests it on real events and on the edge cases you
named, and arms it the way its runtime can be woken: a background command
that ends at the next match and wakes the agent (restarted after each one), a
stream of notifications (Claude Code's Monitor), or a watch that runs on after
the session and pushes to your phone or resumes the session. It asks you once
for a TypeSafe API key and keeps it in `~/.jevable/key`.

## By hand

```bash
export TYPESAFE_API_KEY=...          # or put it in ~/.jevable/key
npx -y jevable filter --json --from 'tail -n 0 -F app.log' \
  'line.contains("ERROR") && judge.boolean(line, "Does this log line report that a service or a dependency it needs is down or unreachable?") >= 0.7'
```

Node 20+. `npx -y jevable <command>` needs no install; `npm i -g jevable` gives the `jevable` command.

- `jevable filter [RULE]` — print what passes, from stdin or `--from CMD`. `--json`, `--key`, `--cooldown`, `--window`, `-m`, `--state`, `--all`.
- `jevable test [RULE] --yes ... --no ...` — run a rule on samples, show the scores and the thresholds that separate them.
- `jevable guide` — everything an agent needs: the steps, how each runtime gets the events back, rules, options, recipes ([guide.md](guide.md)).

## As a library

```ts
import { Client, Engine } from "jevable"; // or @jevable/core, the engine alone

const engine = new Engine(new Client({ apiKey: process.env.TYPESAFE_API_KEY }));
const rule = engine.compile(`judge.boolean(line, "Does this report a production outage?") >= 0.7`);
const { pass, calls } = await rule.match({ line: "checkout returns 500 for every order" });
```
