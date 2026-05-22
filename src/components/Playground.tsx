import { useState, useEffect } from "react";
import type { BrewFont } from "../types";
import { detectLocalFont } from "../lib/brewApi";
import { ArrowLeftIcon, CopyIcon, CheckIcon } from "./Icons";

interface Props {
  fonts: BrewFont[];
  onClose: () => void;
}

const DEFAULT_TEXT =
  "The quick brown fox jumps over the lazy dog.\nPack my box with five dozen liquor jugs.\n\nAaBbCcDdEeFfGgHhIiJjKkLlMm\n0123456789 !@#$%^&*()_+-=[]{}|;:,./<>?";

export function Playground({ fonts, onClose }: Props) {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [fontSize, setFontSize] = useState(28);
  const [lineHeight, setLineHeight] = useState(1.5);
  const [loadedFonts, setLoadedFonts] = useState<Set<string>>(new Set());
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    fonts.forEach((font) => {
      detectLocalFont(font.token, font.name).then((ok) => {
        if (ok) setLoadedFonts((prev) => new Set([...prev, font.token]));
      });
    });
  }, [fonts]);

  const handleCopy = (font: BrewFont) => {
    navigator.clipboard.writeText(font.installCmd);
    setCopiedToken(font.token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#080808] text-white flex flex-col">
      {/* Toolbar */}
      <header className="shrink-0 flex items-center gap-4 px-6 py-3 border-b border-white/5 bg-[#080808]/80 backdrop-blur-xl">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="w-px h-4 bg-white/10" />

        <div className="flex items-center gap-3">
          <label className="text-xs text-white/30 whitespace-nowrap">
            Size
          </label>
          <input
            type="range"
            min={12}
            max={96}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="w-28 accent-violet-500"
          />
          <span className="text-xs text-white/40 w-9 text-right tabular-nums">
            {fontSize}px
          </span>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-white/30 whitespace-nowrap">
            Leading
          </label>
          <input
            type="range"
            min={10}
            max={30}
            value={Math.round(lineHeight * 10)}
            onChange={(e) => setLineHeight(Number(e.target.value) / 10)}
            className="w-24 accent-violet-500"
          />
          <span className="text-xs text-white/40 w-6 text-right tabular-nums">
            {lineHeight.toFixed(1)}
          </span>
        </div>

        <span className="ml-auto text-xs text-white/20">
          Comparing {fonts.length} font{fonts.length !== 1 ? "s" : ""}
        </span>
      </header>

      {/* Sample text input */}
      <div className="shrink-0 border-b border-white/5 bg-[#0d0d0d] px-8 py-4">
        <label className="block text-[10px] uppercase tracking-widest text-white/20 mb-2">
          Sample text
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          spellCheck={false}
          className="w-full bg-transparent text-white/60 text-sm font-mono outline-none resize-none placeholder:text-white/15 leading-relaxed"
          placeholder="Type to preview…"
        />
      </div>

      {/* Font comparison panels */}
      <div className="flex-1 overflow-y-auto">
        {fonts.map((font, i) => {
          const isLoaded = loadedFonts.has(font.token);
          const customFamily = `bf-${font.token}`;
          const fallback =
            font.category === "mono" ? "monospace" : "sans-serif";

          return (
            <div
              key={font.token}
              className={[
                "border-b border-white/5",
                i % 2 === 0 ? "bg-[#0a0a0a]" : "bg-[#080808]",
              ].join(" ")}
            >
              {/* Font header row */}
              <div className="flex items-center gap-3 px-8 py-3 border-b border-white/[0.04]">
                <span className="text-sm font-medium text-white/80">
                  {font.name}
                </span>
                <span className="text-xs font-mono text-white/20">
                  {font.token}
                </span>
                {isLoaded ? (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    Installed
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-white/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/15 inline-block" />
                    Not installed
                  </span>
                )}
                <button
                  onClick={() => handleCopy(font)}
                  className="ml-auto flex items-center gap-1.5 text-xs text-white/25 hover:text-white/60 bg-white/[0.04] hover:bg-white/[0.07] px-3 py-1.5 rounded-lg font-mono transition-all border border-white/5"
                >
                  {copiedToken === font.token ? (
                    <CheckIcon className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <CopyIcon className="w-3 h-3" />
                  )}
                  {font.installCmd}
                </button>
              </div>

              {/* Rendered text */}
              <div className="px-8 py-8">
                <pre
                  className="text-white/75 whitespace-pre-wrap break-words"
                  style={{
                    fontFamily: isLoaded
                      ? `"${customFamily}", ${fallback}`
                      : fallback,
                    fontSize: `${fontSize}px`,
                    lineHeight,
                    opacity: isLoaded ? 1 : 0.5,
                  }}
                >
                  {text}
                </pre>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
