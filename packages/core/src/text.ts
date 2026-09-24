// Plain-text helpers shared by the engine and its callers.

/** One input line: the text, and the parsed value when the line is JSON. */
export function parseRecord(line: string): { line: string; json: unknown } {
  const t = line.trim();
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      return { line, json: JSON.parse(t) };
    } catch {
      // not JSON after all
    }
  }
  return { line, json: null };
}

// Each string sent to Jev is bounded; longer ones keep their head and tail,
// where the question and the verdict of a long text usually sit.
const MAX_STRING_CHARS = 2000;

export function cutLongStrings(v: unknown): unknown {
  if (typeof v === "string") {
    const chars = Array.from(v);
    if (chars.length <= MAX_STRING_CHARS) return v;
    return chars.slice(0, 1500).join("") + " […] " + chars.slice(-500).join("");
  }
  if (Array.isArray(v)) return v.map(cutLongStrings);
  if (v !== null && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, cutLongStrings(x)]));
  }
  return v;
}

const QUOTED = /"[^"]*"|'[^']*'/g;
const TOKEN = /[A-Za-z0-9_.:\-]*[0-9][A-Za-z0-9_.:\-]*/g;
const NUMBER = /^-?[0-9]+(\.[0-9]+)?([A-Za-z%]{0,3})$/;

/**
 * Reduces a line to its kind: quoted strings, numbers and id-like tokens
 * (anything containing a digit) become placeholders, so `timeout after
 * 3012ms on req_8f2a` and `timeout after 95ms on req_77c1` share a
 * fingerprint. Numbers are gone afterwards — compare them in plain CEL.
 */
export function fingerprint(s: string): string {
  return s
    .replace(QUOTED, '"<s>"')
    .replace(TOKEN, (tok) => {
      const m = NUMBER.exec(tok);
      return m ? `<n>${m[2]}` : "<id>";
    })
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

export function clip(s: string, n: number): string {
  const chars = Array.from(s);
  return chars.length <= n ? s : chars.slice(0, n).join("") + "…";
}
