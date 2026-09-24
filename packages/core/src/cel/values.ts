import { isCelList, isCelMap, isCelUint, type CelInput, type CelValue } from "@bufbuild/cel";

/** Turns a CEL value into plain JSON-able values. */
export function fromCel(v: CelValue | unknown): unknown {
  if (typeof v === "bigint") return Number(v);
  if (isCelUint(v)) return Number(v.value);
  if (isCelMap(v)) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of v) out[String(isCelUint(k) ? k.value : k)] = fromCel(x);
    return out;
  }
  if (isCelList(v)) return Array.from(v, fromCel);
  if (v === null || typeof v !== "object") return v;
  return String(v);
}

/** Turns parsed JSON into CEL input: objects become maps. */
export function toCel(v: unknown): CelInput {
  if (Array.isArray(v)) return v.map(toCel);
  if (v !== null && typeof v === "object") {
    return new Map(Object.entries(v).map(([k, x]) => [k, toCel(x)])) as CelInput;
  }
  return v as CelInput;
}
