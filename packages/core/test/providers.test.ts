import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { choose, Client, lookup, whose } from "../src/index.ts";

test("the first provider with a key is chosen, in preference order", () => {
  const found = lookup({ OPENROUTER_API_KEY: "or", AI_GATEWAY_API_KEY: "gw" });
  assert.deepEqual(
    found.map((f) => [f.provider.name, f.variable]),
    [["typesafe", undefined], ["vercel", "AI_GATEWAY_API_KEY"], ["openrouter", "OPENROUTER_API_KEY"], ["perplexity", undefined]],
  );
  assert.equal(choose(found)?.provider.name, "vercel");
  assert.equal(choose(found, "openrouter")?.key, "or");
});

test("JEV_BASE_URL puts a custom endpoint first, keyed by JEV_API_KEY", () => {
  const chosen = choose(lookup({ JEV_BASE_URL: "http://proxy", JEV_API_KEY: "k", OPENROUTER_API_KEY: "or" }));
  assert.deepEqual([chosen?.provider.name, chosen?.provider.baseUrl, chosen?.key], ["custom", "http://proxy", "k"]);
});

test("a key tells whose it is by how it starts", () => {
  assert.deepEqual(
    ["sk-or-v1-abc", "vck_abc", "apikey_abc", "pplx-abc", "sk-ant-abc"].map((k) => whose(k)?.name),
    ["openrouter", "vercel", "typesafe", "perplexity", undefined],
  );
});

test("no key anywhere chooses nothing", () => {
  assert.equal(choose(lookup({})), undefined);
});

/** A server that answers every request with `body`, recording the paths asked for. */
async function serve(body: unknown) {
  const paths: string[] = [];
  const server = createServer((req, res) => {
    paths.push(req.url ?? "");
    req.resume().on("end", () => res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(body)));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, paths, close: () => new Promise((r) => server.close(r)) };
}

test("a catalog lists decision models, as TypeSafe or a gateway shapes it", async () => {
  const typesafe = await serve({ models: [{ name: "jev-latest" }, { name: "jev-preview" }] });
  const gateway = await serve({ data: [{ id: "typesafe-ai/jev", type: "evaluation" }, { id: "openai/gpt-6", type: "language" }, { id: "liquid/d1", type: "evaluation" }, { id: "kev-4b" }] });
  const client = new Client({ apiKey: "k" });
  assert.deepEqual(await client.models(`${typesafe.url}/v1/models`), ["jev-latest", "jev-preview"]);
  assert.deepEqual(await client.models(`${gateway.url}/v1/models`), ["typesafe-ai/jev", "liquid/d1", "kev-4b"]);
  await Promise.all([typesafe.close(), gateway.close()]);
});

test("a provider's path is where the questions go", async () => {
  const s = await serve({ answers: { q: { type: "noul", noul: 0.9 } }, usage: { input_tokens: 1, output_tokens: 0 } });
  const p = whose("pplx-abc")!;
  await new Client({ apiKey: "k", baseUrl: s.url, path: p.path }).ask("x", { q: { type: "noul", instructions: "?" } });
  assert.deepEqual(s.paths, ["/v1/decisions"]);
  await s.close();
});
