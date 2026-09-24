# jevable

`jev` is grep that reads meaning. `jev filter` reads records from stdin, one
per line, and prints the ones that pass a rule — a CEL expression that can ask
[Jev](https://docs.typesafe.ai), TypeSafe's fast and cheap classification
model, a semantic question. It is the missing middle of an agent's
self-trigger: the agent already knows how to fetch events and how to be woken
by output; jev decides which events are worth waking for.

```bash
export TYPESAFE_API_KEY=...
tail -n 0 -F app.log | npx -y jevable filter --json \
  'line.contains("ERROR") && judge.boolean(line, "Does this log line report that a service or a dependency it needs is down or unreachable?") >= 0.7'
```

Node 20+. `npx -y jevable <command>` needs no install; `npm i -g jevable` gives the `jev` command.

## Commands

- `jev filter [RULE]` — print what passes. `--json`, `--key`, `--cooldown`, `--window`, `-m`, `--state`, `--all`.
- `jev test [RULE] --yes ... --no ...` — run a rule on samples, show the scores and the thresholds that separate them.
- `jev guide` — what an agent should do and the full reference: steps, rules, options, recipes ([guide.md](guide.md)). Point an agent at it: "run `npx -y jevable guide` and follow it".

## As a library

```ts
import { Client, Engine } from "jevable"; // or @jevable/core, the engine alone

const engine = new Engine(new Client({ apiKey: process.env.TYPESAFE_API_KEY }));
const rule = engine.compile(`judge.boolean(line, "Does this report a production outage?") >= 0.7`);
const { pass, calls } = await rule.match({ line: "checkout returns 500 for every order" });
```
