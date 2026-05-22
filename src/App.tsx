import { useState, useMemo, useEffect } from "react";
import { id } from "@instantdb/react";
import { db } from "./lib/db";
import { fetchBrewFonts } from "./lib/brewApi";
import { getDeviceId } from "./lib/deviceId";
import type { BrewFont, FontCategory } from "./types";
import { FontCard } from "./components/FontCard";
import { Playground } from "./components/Playground";
import {
  SearchIcon,
  XIcon,
  PlayIcon,
  HeartIcon,
  TerminalIcon,
  GridIcon,
} from "./components/Icons";

type FilterType = "all" | FontCategory | "favorites";

const DEVICE_ID = getDeviceId();
const PAGE_SIZE = 60;

const FILTERS: { id: FilterType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mono", label: "Monospace" },
  { id: "serif", label: "Serif" },
  { id: "sans", label: "Sans-Serif" },
  { id: "favorites", label: "Favorites" },
];

function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-12 h-12 rounded-2xl bg-violet-600/20 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-white/60 text-sm">Fetching Homebrew font catalog…</p>
        <p className="text-white/25 text-xs mt-1">This is cached for 24 hours</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center">
        <XIcon className="w-5 h-5 text-red-400" />
      </div>
      <p className="text-white/60 text-sm">Failed to load fonts</p>
      <p className="text-white/25 text-xs font-mono">{message}</p>
    </div>
  );
}

function EmptyState({ query, filter }: { query: string; filter: FilterType }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
      <GridIcon className="w-8 h-8 text-white/10" />
      <p className="text-white/40 text-sm">
        {query
          ? `No fonts match "${query}"`
          : filter === "favorites"
          ? "No favorites yet — click the heart on any font card"
          : "No fonts in this category"}
      </p>
    </div>
  );
}

export default function App() {
  // ── InstantDB (always called first, unconditionally) ──────────────────────
  const { data, error: dbError } = db.useQuery({
    favorites: {
      $: { where: { deviceId: DEVICE_ID } },
    },
  });

  // ── Local state ───────────────────────────────────────────────────────────
  const [fonts, setFonts] = useState<BrewFont[]>([]);
  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [rawSearch, setRawSearch] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showPlayground, setShowPlayground] = useState(false);
  const [page, setPage] = useState(1);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchBrewFonts()
      .then(setFonts)
      .catch((e: Error) => setApiError(e.message))
      .finally(() => setApiLoading(false));
  }, []);

  // Debounce search so we don't filter 1500+ items on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setSearch(rawSearch), 200);
    return () => clearTimeout(t);
  }, [rawSearch]);

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
  }, [search, activeFilter]);

  // ── Derived values ────────────────────────────────────────────────────────
  const favoriteTokens = useMemo(
    () => new Set((data?.favorites ?? []).map((f) => f.fontToken as string)),
    [data?.favorites]
  );

  const favoriteIdMap = useMemo(
    () =>
      new Map(
        (data?.favorites ?? []).map((f) => [f.fontToken as string, f.id])
      ),
    [data?.favorites]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fonts.filter((f) => {
      const matchesSearch =
        !q ||
        f.name.toLowerCase().includes(q) ||
        f.token.includes(q) ||
        f.description.toLowerCase().includes(q);

      const matchesFilter =
        activeFilter === "all"
          ? true
          : activeFilter === "favorites"
          ? favoriteTokens.has(f.token)
          : f.category === activeFilter;

      return matchesSearch && matchesFilter;
    });
  }, [fonts, search, activeFilter, favoriteTokens]);

  const paginated = useMemo(
    () => filtered.slice(0, page * PAGE_SIZE),
    [filtered, page]
  );

  const selectedFonts = useMemo(
    () => fonts.filter((f) => selected.has(f.token)),
    [fonts, selected]
  );

  // ── Handlers ──────────────────────────────────────────────────────────────
  const toggleFavorite = (token: string) => {
    const existingId = favoriteIdMap.get(token);
    if (existingId) {
      db.transact(db.tx.favorites[existingId].delete());
    } else {
      db.transact(
        db.tx.favorites[id()].update({
          fontToken: token,
          deviceId: DEVICE_ID,
          createdAt: Date.now(),
        })
      );
    }
  };

  const toggleSelect = (token: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(token) ? next.delete(token) : next.add(token);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  // ── Early returns (after all hooks) ───────────────────────────────────────
  if (showPlayground && selectedFonts.length > 0) {
    return (
      <Playground
        fonts={selectedFonts}
        onClose={() => setShowPlayground(false)}
      />
    );
  }

  const isLoading = apiLoading;
  const error = dbError?.message ?? apiError;

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#080808]/80 backdrop-blur-2xl border-b border-white/5">
        <div className="max-w-screen-2xl mx-auto px-6">
          {/* Top row */}
          <div className="flex items-center gap-4 h-14">
            {/* Logo */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
                <TerminalIcon className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-semibold text-base tracking-tight text-white/90">
                BrewFonts
              </span>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-lg mx-auto relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
              <input
                type="text"
                placeholder="Search fonts…"
                value={rawSearch}
                onChange={(e) => setRawSearch(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-8 pr-8 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/15 focus:bg-white/[0.06] transition-all"
              />
              {rawSearch && (
                <button
                  onClick={() => setRawSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Right side: font count */}
            <div className="shrink-0 text-xs text-white/20 tabular-nums">
              {isLoading
                ? "Loading…"
                : `${filtered.length.toLocaleString()} fonts`}
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1 pb-3 overflow-x-auto scrollbar-none">
            {FILTERS.map((f) => {
              const count =
                f.id === "all"
                  ? fonts.length
                  : f.id === "favorites"
                  ? favoriteTokens.size
                  : fonts.filter((font) => font.category === f.id).length;
              return (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  className={[
                    "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                    activeFilter === f.id
                      ? "bg-white/10 text-white"
                      : "text-white/30 hover:text-white/60 hover:bg-white/5",
                  ].join(" ")}
                >
                  {f.id === "favorites" && (
                    <HeartIcon
                      className="w-3 h-3"
                      filled={activeFilter === "favorites"}
                    />
                  )}
                  {f.label}
                  {count > 0 && (
                    <span
                      className={
                        activeFilter === f.id
                          ? "text-white/40"
                          : "text-white/20"
                      }
                    >
                      {count.toLocaleString()}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="max-w-screen-2xl mx-auto px-6 py-8 pb-32">
        {isLoading && <LoadingScreen />}
        {!isLoading && error && <ErrorScreen message={error} />}
        {!isLoading && !error && (
          <>
            {filtered.length === 0 ? (
              <EmptyState query={search} filter={activeFilter} />
            ) : (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: "12px",
                  }}
                >
                  {paginated.map((font) => (
                    <FontCard
                      key={font.token}
                      font={font}
                      isSelected={selected.has(font.token)}
                      isFavorite={favoriteTokens.has(font.token)}
                      onToggleSelect={toggleSelect}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>

                {paginated.length < filtered.length && (
                  <div className="flex justify-center mt-10">
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      className="px-6 py-2.5 bg-white/[0.04] border border-white/8 hover:border-white/15 hover:bg-white/[0.07] text-white/40 hover:text-white/70 rounded-xl text-sm transition-all"
                    >
                      Load{" "}
                      {Math.min(
                        PAGE_SIZE,
                        filtered.length - paginated.length
                      ).toLocaleString()}{" "}
                      more
                      <span className="text-white/20 ml-2">
                        ({(filtered.length - paginated.length).toLocaleString()}{" "}
                        remaining)
                      </span>
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* ── Selection toolbar (floating) ─────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <div className="flex items-center gap-3 bg-[#111] border border-white/10 rounded-2xl px-5 py-3 shadow-2xl shadow-black/50 backdrop-blur-xl">
            <span className="text-sm text-white/50">
              {selected.size} font{selected.size !== 1 ? "s" : ""} selected
            </span>
            <div className="w-px h-4 bg-white/10" />
            <button
              onClick={() => setShowPlayground(true)}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-1.5 rounded-xl transition-colors"
            >
              <PlayIcon className="w-3.5 h-3.5" />
              Open Playground
            </button>
            <button
              onClick={clearSelection}
              className="text-white/30 hover:text-white/60 transition-colors"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
