// Where a decision model can be reached. Every provider here speaks TypeSafe's
// System One API (POST <baseUrl><path>) with the same request and answer
// shapes; they differ in base URL, path, credential and the models they serve.
// Jev is the default wherever it is served.

import { DEFAULT_BASE_URL, DEFAULT_MODEL, DEFAULT_PATH } from "./client.ts";

export interface Provider {
  name: string;
  label: string;
  baseUrl: string;
  /** The System One endpoint under baseUrl. */
  path: string;
  /** The default model: Jev as this provider names it, pinned where the provider allows. */
  model: string;
  /** Where it lists the decision models a key can use (Client.models), if it does. */
  catalog?: string;
  /** Variables holding its credential, the first set one wins. */
  env: readonly string[];
  /** How its keys start, to tell whose a pasted key is. */
  prefix: string;
}

/** In the order jevable prefers them. */
export const PROVIDERS: readonly Provider[] = [
  { name: "typesafe", label: "TypeSafe", baseUrl: DEFAULT_BASE_URL, path: DEFAULT_PATH, model: DEFAULT_MODEL, catalog: `${DEFAULT_BASE_URL}/v1/models`, env: ["TYPESAFE_API_KEY", "JEV_API_KEY"], prefix: "apikey_" },
  // AI Gateway lists Jev under one id only; it does not take a version.
  { name: "vercel", label: "Vercel AI Gateway", baseUrl: "https://ai-gateway.vercel.sh/typesafe", path: DEFAULT_PATH, model: "typesafe-ai/jev", catalog: "https://ai-gateway.vercel.sh/v1/models", env: ["AI_GATEWAY_API_KEY", "VERCEL_OIDC_TOKEN"], prefix: "vck_" },
  { name: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api", path: DEFAULT_PATH, model: "typesafe/jev-1.13", catalog: "https://openrouter.ai/api/v1/models?output_modalities=decisions", env: ["OPENROUTER_API_KEY"], prefix: "sk-or-" },
  // Perplexity serves its own decision model only, at another path.
  { name: "perplexity", label: "Perplexity", baseUrl: "https://api.perplexity.ai", path: "/v1/decisions", model: "pplx-decider-v1-27b", env: ["PERPLEXITY_API_KEY", "PPLX_API_KEY"], prefix: "pplx-" },
];

/** The provider a key belongs to, told by how it starts. */
export function whose(key: string): Provider | undefined {
  return PROVIDERS.find((p) => key.startsWith(p.prefix));
}

export interface Found {
  provider: Provider;
  /** The variable the credential came from, when one is set. */
  variable?: string;
  key?: string;
}

/**
 * Every provider with the credential found for it in `vars`. JEV_BASE_URL
 * adds a custom endpoint (a proxy) ahead of the rest, keyed by JEV_API_KEY.
 */
export function lookup(vars: Readonly<Record<string, string | undefined>>): Found[] {
  const custom: Provider[] = vars.JEV_BASE_URL
    ? [{ name: "custom", label: vars.JEV_BASE_URL, baseUrl: vars.JEV_BASE_URL, path: DEFAULT_PATH, model: DEFAULT_MODEL, catalog: `${vars.JEV_BASE_URL.replace(/\/+$/, "")}/v1/models`, env: ["JEV_API_KEY", "TYPESAFE_API_KEY"], prefix: "" }]
    : [];
  return [...custom, ...PROVIDERS].map((provider) => {
    const variable = provider.env.find((v) => vars[v]);
    return { provider, variable, key: variable && vars[variable] };
  });
}

/** The provider to use: the one named (JEV_PROVIDER), else the first with a credential. */
export function choose(found: Found[], name?: string): Found | undefined {
  return name ? found.find((f) => f.provider.name === name) : found.find((f) => f.key);
}
