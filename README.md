# jevable

**Make your monitor smart.** An agent watching a log, a feed or an API pays a
full turn for every line that wakes it, or misses what a grep did not foresee.
jevable is grep that reads meaning: [Jev](https://docs.typesafe.ai), TypeSafe's
fast and cheap classification model, judges each line in about 0.3 s for about
$0.00002, and only what matters wakes the agent — or reaches you. The same
pipe sifts any pile an agent would otherwise read in full: issues, comments,
commits, search results.

```sh
tail -n 0 -F app.log | npx -y jevable "Does this line report that a dependency is down?"
gh issue list --json number,title,body | jq -c '.[]' | npx -y jevable --on .body "Is this a bug report about login?"
```

See the [package README](packages/cli/README.md) for setup and how to teach
your agent to use it, and the [guide](packages/cli/guide.md)
(`jevable guide`) for asking, testing, CEL rules and watching streams.
Measured on 334 real events: 7.3× fewer agent wakes than waking on every
event, 85% of what mattered caught where a keyword alert caught 25%
([jevable.sh/bench](https://jevable.sh/bench)).

## Layout

| Path | Package | What |
| --- | --- | --- |
| `packages/core` | `@jevable/core` | The rule engine: CEL rules with `judge.boolean` / `judge.choice` / `judge.score`, the Jev client, `fingerprint`. Shared by everything else. |
| `packages/cli` | `jevable` | The `jevable` command (`npx -y jevable`). Usage in its [README](packages/cli/README.md). `jevable guide` prints [guide.md](packages/cli/guide.md): the steps an agent follows and the full reference. |

| `packages/web` | `@jevable/web` (private) | [jevable.sh](https://jevable.sh): the landing page and `/guide` (rendered from the CLI's guide.md). Astro, static, on Cloudflare Workers. `npm run dev -w packages/web`; `npm run demo-data -w packages/web` re-records the demo's Jev answers from `cases/`; `npm run deploy -w packages/web`. |

A hosted service goes next to them in `packages/server`, on top of `@jevable/core`.

## Develop

```bash
npm install
npm test            # every package, against a fake Jev (@jevable/core/testing)
npm run typecheck
npm run build       # dist/ per package; core first
```

Tests and local runs use the TypeScript sources directly through the
`jevable-source` export condition (`node --conditions=jevable-source`);
published packages use `dist/`. Not open source: packages are `UNLICENSED`.
