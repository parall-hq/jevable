import assert from "node:assert/strict";
import { test } from "node:test";
import { choose, lookup, whose } from "../src/index.ts";

test("the first provider with a key is chosen, in preference order", () => {
  const found = lookup({ OPENROUTER_API_KEY: "or", AI_GATEWAY_API_KEY: "gw" });
  assert.deepEqual(
    found.map((f) => [f.provider.name, f.variable]),
    [["typesafe", undefined], ["vercel", "AI_GATEWAY_API_KEY"], ["openrouter", "OPENROUTER_API_KEY"]],
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
    ["sk-or-v1-abc", "vck_abc", "apikey_abc", "sk-ant-abc"].map((k) => whose(k)?.name),
    ["openrouter", "vercel", "typesafe", undefined],
  );
});

test("no key anywhere chooses nothing", () => {
  assert.equal(choose(lookup({})), undefined);
});
