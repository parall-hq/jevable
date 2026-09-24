# @jevable/core

The rule engine behind [`jev`](../cli/README.md): CEL expressions over a
record (`line`, `json`) or a window (`window`) that can ask
[Jev](https://docs.typesafe.ai) semantic questions through `judge.boolean`,
`judge.choice` and `judge.score`. Plain conditions decide first; Jev is asked
only when they cannot, and the same question on the same material once.

```ts
import { Client, Engine, parseRecord, toCel } from "@jevable/core";

const engine = new Engine(new Client({ apiKey: process.env.TYPESAFE_API_KEY }));
const rule = engine.compile(`json.user != "bot" && judge.boolean(json.body, "Does this comment ask for a code change?") >= 0.7`);

const { line, json } = parseRecord(`{"user": "alice", "body": "can you rename this?"}`);
const { pass, calls, error } = await rule.match({ line, json: toCel(json) });
```

`compile` throws a `RuleError` for a rule that cannot work (unknown variable,
unknown function, a judge call not compared with a threshold).
`@jevable/core/testing` serves a fake Jev for tests.
