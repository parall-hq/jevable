// /guide.md: the guide as plain text, for agents that fetch instead of running npx.
import { guide } from "../lib/guide.ts";

export const GET = () => new Response(guide, { headers: { "content-type": "text/markdown; charset=utf-8" } });
