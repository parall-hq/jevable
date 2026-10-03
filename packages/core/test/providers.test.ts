import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { accountOf, choose, Client, HttpError, lookup, whose, withAccount } from "../src/index.ts";

test("the first provider with a key is chosen, in preference order", () => {
  const found = lookup({ OPENROUTER_API_KEY: "or", AI_GATEWAY_API_KEY: "gw" });
  assert.deepEqual(
    found.map((f) => [f.provider.name, f.variable]),
    [["typesafe", undefined], ["vercel", "AI_GATEWAY_API_KEY"], ["openrouter", "OPENROUTER_API_KEY"], ["perplexity", undefined], ["cloudflare", undefined]],
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
    ["sk-or-v1-abc", "vck_abc", "apikey_abc", "pplx-abc", "cfat_abc", "sk-ant-abc"].map((k) => whose(k)?.name),
    ["openrouter", "vercel", "typesafe", "perplexity", "cloudflare", undefined],
  );
});

test("no key anywhere chooses nothing", () => {
  assert.equal(choose(lookup({})), undefined);
});

/** A server that answers every request with `body` and `status`, recording the paths asked for and the bodies sent. */
async function serve(body: unknown, status = 200) {
  const paths: string[] = [];
  const bodies: unknown[] = [];
  const server = createServer((req, res) => {
    paths.push(req.url ?? "");
    let sent = "";
    req.on("data", (c) => (sent += c));
    req.on("end", () => {
      if (sent) bodies.push(JSON.parse(sent));
      res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, paths, bodies, close: () => new Promise((r) => server.close(r)) };
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

test("Cloudflare: the model goes in the URL, not the body, and the answer comes wrapped", async () => {
  const s = await serve({ result: { model: "clef-flash", answers: { q: { type: "noul", noul: 0.96 } }, usage: { input_tokens: 220, output_tokens: 0 } }, success: true, errors: [] });
  const p = withAccount(whose("cfat_abc")!, "acc1");
  assert.equal(p.baseUrl, "https://api.cloudflare.com/client/v4/accounts/acc1/ai");
  const res = await new Client({ apiKey: "k", baseUrl: s.url, path: p.path, model: p.model }).ask("Redis is down", { q: { type: "noul", instructions: "?" } });
  assert.equal(res.answers.q.noul, 0.96);
  assert.deepEqual(s.paths, ["/run/@cf/cloudflare/clef-flash"]);
  assert.equal((s.bodies[0] as { model?: string }).model, undefined);
  await s.close();
});

test("Cloudflare: errors read as their message, the catalog lists names, and the account comes from the key", async () => {
  const bad = await serve({ success: false, errors: [{ code: 7000, message: "No route for that URI" }] }, 400);
  await assert.rejects(new Client({ apiKey: "k", baseUrl: bad.url }).ask("x", { q: { type: "noul", instructions: "?" } }), (e: HttpError) => /400: No route for that URI$/.test(e.message));
  const catalog = await serve({ result: [{ id: "87f3-uuid", name: "@cf/cloudflare/clef" }, { id: "059d-uuid", name: "@cf/cloudflare/clef-flash" }] });
  assert.deepEqual(await new Client({ apiKey: "k" }).models(catalog.url, "name"), ["@cf/cloudflare/clef", "@cf/cloudflare/clef-flash"]);
  const cf = whose("cfat_abc")!;
  const one = await serve({ result: [{ id: "acc1" }] });
  assert.equal(await accountOf({ ...cf, account: { ...cf.account!, list: one.url } }, "k"), "acc1");
  const two = await serve({ result: [{ id: "a" }, { id: "b" }] });
  await assert.rejects(accountOf({ ...cf, account: { ...cf.account!, list: two.url } }, "k"), /reaches 2 accounts: set CLOUDFLARE_ACCOUNT_ID/);
  const found = choose(lookup({ CLOUDFLARE_API_TOKEN: "cfat_x", CLOUDFLARE_ACCOUNT_ID: "acc9" }));
  assert.deepEqual([found?.provider.name, found?.provider.baseUrl, found?.provider.catalog?.includes("/accounts/acc9/")], ["cloudflare", "https://api.cloudflare.com/client/v4/accounts/acc9/ai", true]);
  await Promise.all([bad.close(), catalog.close(), one.close(), two.close()]);
});
