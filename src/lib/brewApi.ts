import type { BrewFont, FontCategory } from "../types";

const CACHE_KEY = "bf-cask-cache";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEnvelope {
  ts: number;
  data: BrewFont[];
}

interface RawCask {
  token: string;
  desc: string | null;
  name: string | string[];
}

const MONO_KEYWORDS = [
  "mono", "code", "console", "terminal", "typewriter", "courier",
  "hack", "inconsolata", "fira-code", "jetbrains", "source-code",
  "cascadia", "fantasque", "iosevka", "commit", "menlo", "monaco",
  "victor-mono", "ubuntu-mono", "space-mono", "nerd-font", "ligature",
  "dank-mono", "operator-mono", "recursive", "input-mono", "proggy",
];

const SERIF_KEYWORDS = [
  "serif", "garamond", "palatino", "caslon", "baskerville", "didot",
  "bodoni", "minion", "charter", "vollkorn", "lora", "merriweather",
  "pt-serif", "libre-baskerville", "eb-garamond", "cardo", "playfair",
  "cormorant", "trajan", "bookman", "century", "arvo", "bitter",
  "crimson", "neuton", "spectral", "gfs", "alegreya", "gentium",
];

/** Results of local-font probes, keyed by brew token. */
const detectCache = new Map<string, Promise<string | null>>();

function categorize(token: string): FontCategory {
  const t = token.toLowerCase();
  if (MONO_KEYWORDS.some((k) => t.includes(k))) return "mono";
  if (SERIF_KEYWORDS.some((k) => t.includes(k))) return "serif";
  return "sans";
}

function tokenToName(token: string): string {
  return token
    .replace(/^font-/, "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Strip brew parentheticals like "Hack Nerd Font (Hack)" → "Hack Nerd Font". */
function cleanFamilyName(name: string): string {
  return name
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * CSS `font-family` uses the family name; `@font-face local()` needs the
 * full name or PostScript name. Brew gives us family-ish strings, so we
 * build a few candidates and let the browser pick the first installed one.
 */
export function familyCandidates(token: string, name: string): string[] {
  const out: string[] = [];
  const add = (value: string) => {
    const trimmed = value.replace(/"/g, "").trim();
    if (trimmed && !out.includes(trimmed)) out.push(trimmed);
  };

  add(name);
  add(cleanFamilyName(name));
  add(tokenToName(token));

  return out;
}

export function fallbackFamily(category: FontCategory): string {
  if (category === "mono") return "monospace";
  if (category === "serif") return "serif";
  return "sans-serif";
}

/** Stack for inline styles — real family names first, then a generic fallback. */
export function fontFamilyStack(font: BrewFont, resolvedFamily?: string | null): string {
  const names = resolvedFamily
    ? [resolvedFamily]
    : familyCandidates(font.token, font.name);
  return [
    ...names.map((n) => `"${n}"`),
    fallbackFamily(font.category),
  ].join(", ");
}

function measureTextWidth(fontShorthand: string, sample: string): number {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;
  ctx.font = fontShorthand;
  return ctx.measureText(sample).width;
}

/**
 * Canvas metric probe: if `"Family", baseline` draws differently than
 * `baseline` alone, the family is available to the browser.
 */
function isFamilyInstalled(familyName: string): boolean {
  const sample = "mmmmmmmmmmlli";
  const size = "72px";
  const baselines = ["monospace", "sans-serif", "serif"] as const;

  return baselines.some((base) => {
    const withFamily = measureTextWidth(
      `${size} "${familyName}", ${base}`,
      sample
    );
    const baseline = measureTextWidth(`${size} ${base}`, sample);
    return withFamily !== baseline;
  });
}

/**
 * Try registering a FontFace via local() using full-name / PostScript
 * variants. Family names alone often fail for local(), which is why the
 * old code silently fell through to generic monospace.
 */
async function tryRegisterLocalFace(
  customFamily: string,
  familyName: string
): Promise<boolean> {
  const compact = familyName.replace(/\s+/g, "");
  const hyphenated = familyName.replace(/\s+/g, "-");
  const localSrc = [
    `local("${familyName}")`,
    `local("${familyName} Regular")`,
    `local("${compact}")`,
    `local("${compact}-Regular")`,
    `local("${hyphenated}")`,
    `local("${hyphenated}-Regular")`,
  ].join(", ");

  try {
    const face = new FontFace(customFamily, localSrc);
    await face.load();
    document.fonts.add(face);
    return true;
  } catch {
    return false;
  }
}

function transform(cask: RawCask): BrewFont {
  const rawName = Array.isArray(cask.name) ? cask.name[0] : cask.name;
  const name = rawName || tokenToName(cask.token);
  return {
    token: cask.token,
    name,
    description: cask.desc ?? "",
    category: categorize(cask.token),
    installCmd: `brew install --cask ${cask.token}`,
  };
}

export async function fetchBrewFonts(): Promise<BrewFont[]> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed: CacheEnvelope = JSON.parse(raw);
      if (Date.now() - parsed.ts < CACHE_TTL_MS) return parsed.data;
    }
  } catch {
    // ignore stale/corrupt cache
  }

  const res = await fetch("https://formulae.brew.sh/api/cask.json");
  if (!res.ok) throw new Error(`Homebrew API responded with ${res.status}`);

  const casks: RawCask[] = await res.json();
  const fonts = casks
    .filter((c) => c.token.startsWith("font-"))
    .map(transform)
    .sort((a, b) => a.name.localeCompare(b.name));

  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ts: Date.now(), data: fonts })
    );
  } catch {
    // ignore quota errors
  }

  return fonts;
}

/**
 * Detect whether a brew font is installed locally.
 * Returns the CSS family name that matched, or null if none did.
 */
export function detectLocalFont(
  token: string,
  familyName: string
): Promise<string | null> {
  const cached = detectCache.get(token);
  if (cached) return cached;

  const promise = (async () => {
    const candidates = familyCandidates(token, familyName);

    for (const candidate of candidates) {
      if (isFamilyInstalled(candidate)) {
        // Best-effort: also bind a custom family via local() for engines
        // that resolve full/PostScript names more reliably that way.
        await tryRegisterLocalFace(`bf-${token}`, candidate);
        return candidate;
      }
    }

    // Canvas probe can miss some faces; still try FontFace local() variants.
    for (const candidate of candidates) {
      const custom = `bf-${token}`;
      if (await tryRegisterLocalFace(custom, candidate)) {
        return candidate;
      }
    }

    return null;
  })();

  detectCache.set(token, promise);
  return promise;
}
