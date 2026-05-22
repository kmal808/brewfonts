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

export async function detectLocalFont(
  token: string,
  familyName: string
): Promise<boolean> {
  const customFamily = `bf-${token}`;
  const safeName = familyName.replace(/"/g, "");
  const face = new FontFace(customFamily, `local("${safeName}")`);
  try {
    await face.load();
    document.fonts.add(face);
    return true;
  } catch {
    return false;
  }
}
