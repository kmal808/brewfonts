import { useState, useEffect } from "react";
import type { BrewFont } from "../types";
import { detectLocalFont } from "../lib/brewApi";
import { HeartIcon, CopyIcon, CheckIcon } from "./Icons";

interface Props {
  font: BrewFont;
  isSelected: boolean;
  isFavorite: boolean;
  onToggleSelect: (token: string) => void;
  onToggleFavorite: (token: string) => void;
}

const MONO_PREVIEW = "const fn = (x) => x * 2; // fast";
const TEXT_PREVIEW = "The quick brown fox jumps over the lazy dog.";
const ALPHA_PREVIEW = "AaBbCcDd Ee 0123456789";

const CATEGORY_BADGE: Record<BrewFont["category"], string> = {
  mono: "Mono",
  serif: "Serif",
  sans: "Sans",
};

export function FontCard({
  font,
  isSelected,
  isFavorite,
  onToggleSelect,
  onToggleFavorite,
}: Props) {
  const [isInstalled, setIsInstalled] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    detectLocalFont(font.token, font.name).then((result) => {
      if (!cancelled) setIsInstalled(result);
    });
    return () => {
      cancelled = true;
    };
  }, [font.token, font.name]);

  const customFamily = `bf-${font.token}`;
  const fontStyle = isInstalled
    ? { fontFamily: `"${customFamily}", ${font.category === "mono" ? "monospace" : "sans-serif"}` }
    : undefined;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(font.installCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(font.token);
  };

  const previewLine = font.category === "mono" ? MONO_PREVIEW : TEXT_PREVIEW;

  return (
    <div
      onClick={() => onToggleSelect(font.token)}
      className={[
        "relative flex flex-col p-5 rounded-2xl border cursor-pointer transition-all duration-150 group select-none",
        isSelected
          ? "border-violet-500/50 bg-violet-950/20 shadow-lg shadow-violet-500/10 ring-1 ring-violet-500/20"
          : "border-white/5 bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.05]",
      ].join(" ")}
    >
      {/* Selection indicator */}
      <div
        className={[
          "absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-150 shrink-0",
          isSelected
            ? "border-violet-500 bg-violet-500"
            : "border-white/15 group-hover:border-white/30",
        ].join(" ")}
      >
        {isSelected && <CheckIcon className="w-2.5 h-2.5 text-white" />}
      </div>

      {/* Category + token */}
      <div className="flex items-center gap-2 mb-3 pr-7">
        <span
          className={[
            "text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider",
            font.category === "mono"
              ? "bg-sky-500/15 text-sky-400"
              : font.category === "serif"
              ? "bg-amber-500/15 text-amber-400"
              : "bg-violet-500/15 text-violet-400",
          ].join(" ")}
        >
          {CATEGORY_BADGE[font.category]}
        </span>
        <span className="text-[10px] text-white/20 font-mono truncate">
          {font.token}
        </span>
      </div>

      {/* Font name — rendered in that font if installed */}
      <div
        className="text-[22px] font-medium text-white leading-tight mb-2 truncate"
        style={fontStyle}
      >
        {font.name}
      </div>

      {/* Preview text */}
      <div
        className="text-sm text-white/40 leading-snug mb-1 line-clamp-1"
        style={fontStyle}
      >
        {previewLine}
      </div>
      <div
        className="text-xs text-white/20 mb-4 tracking-wide"
        style={fontStyle}
      >
        {ALPHA_PREVIEW}
      </div>

      {/* Description */}
      {font.description && (
        <p className="text-xs text-white/30 leading-relaxed mb-4 line-clamp-2">
          {font.description}
        </p>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between gap-2">
        {/* Install status */}
        <div className="min-w-0">
          {isInstalled === null && (
            <span className="flex items-center gap-1.5 text-[10px] text-white/20">
              <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse inline-block" />
              Checking
            </span>
          )}
          {isInstalled === true && (
            <span className="flex items-center gap-1.5 text-[10px] text-emerald-400/90">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Installed
            </span>
          )}
          {isInstalled === false && (
            <span className="flex items-center gap-1.5 text-[10px] text-white/20">
              <span className="w-1.5 h-1.5 rounded-full bg-white/15 inline-block" />
              Not installed
            </span>
          )}
        </div>

        {/* Actions */}
        <div
          className="flex items-center gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleCopy}
            title={font.installCmd}
            className="p-1.5 rounded-lg text-white/25 hover:text-white/70 hover:bg-white/5 transition-colors"
          >
            {copied ? (
              <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <CopyIcon className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={handleFavorite}
            className={[
              "p-1.5 rounded-lg transition-colors",
              isFavorite
                ? "text-pink-400 hover:bg-white/5"
                : "text-white/25 hover:text-pink-400 hover:bg-white/5",
            ].join(" ")}
          >
            <HeartIcon className="w-3.5 h-3.5" filled={isFavorite} />
          </button>
        </div>
      </div>
    </div>
  );
}
