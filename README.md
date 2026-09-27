# jevable

Make your monitor smart. `jevable` is grep that reads meaning: it passes through
only the events a [Jev](https://docs.typesafe.ai) judgement lets through, so
an agent — Claude Code, Codex, OpenClaw, Hermes, pi, dsh, any that runs shell
commands — can watch a log, a feed or an API and be woken, or tell you, only
when something counts. One prompt sets it up: see the
[package README](packages/cli/README.md).

## Layout

| Path | Package | What |
| --- | --- | --- |
| `packages/core` | `@jevable/core` | The rule engine: CEL rules with `judge.boolean` / `judge.choice` / `judge.score`, the Jev client, `fingerprint`. Shared by everything else. |
| `packages/cli` | `jevable` | The `jevable` command (`npx -y jevable`). Usage in its [README](packages/cli/README.md). `jevable guide` prints [guide.md](packages/cli/guide.md): the steps an agent follows and the full reference. |

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
