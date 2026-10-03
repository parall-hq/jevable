<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/hero-dark.svg" />
  <img src="docs/assets/hero.svg" alt="jevable" width="276" height="66" />
</picture>

Your agent wakes up for what matters.

<p>
  <a href="https://jevable.sh">Website</a> ·
  <a href="packages/cli/guide.md">Guide</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="https://jevable.sh/bench">Benchmarks</a>
</p>

<p>
  <a href="https://www.npmjs.com/package/jevable"><img src="https://img.shields.io/npm/v/jevable?style=flat-square&amp;label=npm&amp;color=2563eb&amp;labelColor=252525" alt="npm version" /></a>
  <a href="https://github.com/parall-hq/jevable/actions/workflows/ci.yml"><img src="https://github.com/parall-hq/jevable/actions/workflows/ci.yml/badge.svg" alt="CI status" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2563eb?style=flat-square&amp;labelColor=252525" alt="MIT license" /></a>
</p>

Give your agent Jev as an atomic tool. jevable is a bash-native CLI that filters any stream by meaning, powered by [TypeSafe’s Jev](https://docs.typesafe.ai).

Start with one plain-English question, or write rules that mix ordinary conditions with Jev judgments. It prints only what passes and composes with anything your agent can already pipe.

In our 334-event [benchmark](#86-lower-always-on-cost), this cut always-on cost by 86% compared with a 30-minute heartbeat, while catching 85% of what mattered.

## Quick start

Paste this into your agent:

```text
Set up jevable: run `npx -y jevable guide` and follow it.
```

The guide walks your agent through connecting a key, trying a filter and setting up a watch. Works with agents that run shell commands, including Claude Code, Codex, OpenClaw, Hermes, pi and dsh; the guide covers how each runtime receives matches.

<details>
<summary>Or use it directly in your terminal</summary>

Requires Node.js 20.3+ and a Jev API key from TypeSafe, OpenRouter or Vercel AI Gateway.

```bash
# Check and save your key once.
npx -y jevable key YOUR_API_KEY

# Ask a question about each log line.
tail -n 0 -F app.log |
  npx -y jevable "Does this line report that a dependency is down?"
```

Matching lines pass through unchanged. Use `--json` to include scores, `-t 0.8` for a stricter threshold, or `-v` to invert. Exit codes follow grep: `0` for a match, `1` for no matches, `2` for an error.

</details>

## A question in. Matching lines out.

```bash
printf '%s\n' \
  'Deployment completed successfully.' \
  'Redis is unreachable; all cache connections are failing.' \
  'Health check passed.' |
  npx -y jevable "Does this line report that a dependency is down?"
```

Expected stdout for this example:

```text
Redis is unreachable; all cache connections are failing.
```

The matching line is unchanged, ready for the next command in your pipeline. Your question decides what passes.

[Watch demo →](docs/assets/jevable-demo.mp4)

## Give your agent something worth acting on

| Watch | Let through |
| --- | --- |
| Social posts and feeds | Someone describing a problem your product solves |
| Production logs | A dependency failing or a new kind of error |
| GitHub issues | Reports that something which used to work has broken |
| PR review comments | Requests to change the code |
| Dependency releases | Breaking changes or security fixes |

Anything that prints one event per line can be a source. Use a live stream or sift a batch before your agent reads it.

```bash
# Watch a log.
tail -n 0 -F app.log | npx -y jevable "Does this line report that a dependency is down?"

# Filter issues. Judge the body; keep the whole record.
gh issue list --json title,body | jq -c '.[]' | npx -y jevable --on .body "Is this a bug report about login?"
```

For a persistent watch, `--key` identifies repeated events, `--state` remembers them across runs, and `--cooldown` limits repeat notifications. `--window` judges a whole interval, including spikes in volume or a missing heartbeat. See the [watching guide](packages/cli/guide.md#watching-a-stream).

## 86% lower always-on cost

334 events across five streams, replayed over one day per stream:

| Method | Cost | Recall |
| --- | ---: | ---: |
| Heartbeat (30 min) | $40.06 | 100% |
| jevable | $5.44 | 85% |

Costs are replay estimates based on measured Claude Code wakes and Jev calls. jevable caught 44 of 52 relevant events; the heartbeat assumes no misses. [Full benchmark →](https://jevable.sh/bench)

## Plain rules meet semantic judgment

Combine exact checks with natural-language questions using [CEL](packages/cli/guide.md#rules-more-than-one-question):

```bash
npx -y jevable filter '
  json.level == "error" &&
  judge.boolean(json.message, "Does this report that a dependency is down?") >= 0.7
'
```

- Ask only when needed. Put ordinary conditions first; short-circuiting can avoid a model call entirely.
- Choose the judgment. Use `judge.boolean` for yes/no, `judge.choice` for categories, or `judge.score` for ordered levels.
- Reuse answers. The same question on the same material is cached within a run.
- Choose what leaves your machine. Only the material passed to `judge` is sent to the provider. Each string is limited to its first 1,500 and last 500 characters when it exceeds 2,000.

Check your question against examples before relying on it:

```bash
npx -y jevable test "Does this review comment ask for a code change?" \
  --yes "Could you rename this variable?" \
  --no "LGTM, thanks!"
```

The test command shows scores and thresholds that separate your examples. [Full CLI reference →](packages/cli/README.md)

<details>
<summary>Use jevable as a TypeScript library</summary>

```bash
npm install @jevable/core
```

```ts
import { Client, Engine } from "@jevable/core";

const engine = new Engine(new Client({ apiKey: process.env.TYPESAFE_API_KEY }));
const rule = engine.compile(
  'judge.boolean(line, "Does this report a production outage?") >= 0.7',
);

const { pass, calls } = await rule.match({
  line: "checkout returns 500 for every order",
});
```

See [the core package](packages/core/README.md) for the library interface.

</details>

## Layout

| Path | Package | What |
| --- | --- | --- |
| `packages/core` | `@jevable/core` | Shared CEL rule engine, Jev client, caching and fingerprints. |
| `packages/cli` | `jevable` | CLI, streams, windows and persistent state. Includes the agent setup guide and full reference. |
| `packages/web` | `@jevable/web` (private) | Website, demo and benchmarks. Built with Astro on Cloudflare Workers; the guide comes from the CLI’s `guide.md`. |
| `video/launch` | (private) | The 30-second launch video, made in code with Remotion; its soundtrack is synthesized from the same cue sheet. A standalone npm project, outside the workspaces. |

## Develop

Use Node.js 24+ for development; the published CLI supports Node.js 20.3+.

```bash
npm install
npm test             # Every package, against a fake Jev; no API key needed.
npm run typecheck
npm run build        # dist/ per package; core first.
```

Tests and local runs use TypeScript sources directly through the `jevable-source` export condition (`node --conditions=jevable-source`). Published packages use `dist/`.

To work on the website:

```bash
npm run dev -w packages/web
npm run demo-data -w packages/web  # Re-record Jev answers from cases/; needs a key.
npm run deploy -w packages/web    # Build and deploy to Cloudflare Workers; main deploys itself.
```

### Releasing

A pull request that changes what `jevable` or `@jevable/core` ships (their code, the guide, the README npm shows, their dependencies) adds a changeset: run `npx changeset`, pick patch (a fix) or minor (a feature), write one line for the changelog and commit the file. CI checks for it; when a change needs no release, `npx changeset --empty` says so. Do not edit versions by hand: both packages always share one version.

To release, run the **release** workflow by hand (Actions → release → Run workflow, or `gh workflow run release`). It turns the pending changesets into the next version and its changelog and commits that to main, publishes to npm through npm's trusted publishing (no token, with provenance), tags `v<version>` and writes the GitHub release. The website redeploys whenever main changes what it shows.

Bug reports, new watch scenarios and pull requests are welcome. [Open an issue](https://github.com/parall-hq/jevable/issues), or start with the [example cases](cases/README.md).

---

<picture><source media="(prefers-color-scheme: dark)" srcset="docs/assets/parall-dark.svg" /><img src="docs/assets/parall.svg" alt="" width="12" height="17" /></picture> Built by [Parall](https://parall.com). Powered by [Jev from TypeSafe](https://docs.typesafe.ai).

[MIT license](LICENSE) · [Security](SECURITY.md)
