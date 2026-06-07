"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useGraph, type GraphNodeData } from "../graph/graph-provider";

/* ================================================================
   THREADSPACE — Finder Rail
   Search with animated autocomplete · Seed management · Traversal
   ================================================================ */

// ── Mock search data (will be replaced by API) ───────────────────
const SEARCH_DATA: GraphNodeData[] = [
  { id: "s1", label: "The Office", type: "show", score: 0, temperature: "cold", slug: "the-office" },
  { id: "s2", label: "Jim Halpert", type: "character", score: 0, temperature: "cold", slug: "jim-halpert" },
  { id: "s3", label: "Michael Scott", type: "character", score: 0, temperature: "cold", slug: "michael-scott" },
  { id: "s4", label: "Sarcasm", type: "trait", score: 0, temperature: "cold", slug: "sarcasm" },
  { id: "s5", label: "Parks & Rec", type: "show", score: 0, temperature: "cold", slug: "parks-rec" },
  { id: "s6", label: "Leslie Knope", type: "character", score: 0, temperature: "cold", slug: "leslie-knope" },
  { id: "s7", label: "Dry Humor", type: "trait", score: 0, temperature: "cold", slug: "dry-humor" },
  { id: "s8", label: "Ben 10", type: "show", score: 0, temperature: "cold", slug: "ben-10" },
  { id: "s9", label: "Alien X", type: "character", score: 0, temperature: "cold", slug: "alien-x" },
  { id: "s10", label: "Strategic Thinking", type: "trait", score: 0, temperature: "cold", slug: "strategic-thinking" },
  { id: "s11", label: "Optimism", type: "trait", score: 0, temperature: "cold", slug: "optimism" },
  { id: "s12", label: "Sitcom Fan", type: "concept", score: 0, temperature: "cold", slug: "sitcom-fan" },
  { id: "s13", label: "Sci-Fi Fan", type: "concept", score: 0, temperature: "cold", slug: "sci-fi-fan" },
  { id: "s14", label: "Leadership", type: "trait", score: 0, temperature: "cold", slug: "leadership" },
  { id: "s15", label: "Comedy Nerd", type: "concept", score: 0, temperature: "cold", slug: "comedy-nerd" },
];

const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  show: { icon: "📺", color: "#38bdf8" },
  character: { icon: "🎭", color: "#a78bfa" },
  trait: { icon: "✦", color: "#60d4c8" },
  concept: { icon: "◈", color: "#f59e0b" },
  person: { icon: "👤", color: "#f97066" },
  community: { icon: "🌐", color: "#34d399" },
  derived: { icon: "🔮", color: "#818cf8" },
};

export function FinderRail() {
  const { seeds, addSeed, removeSeed, clearSeeds, isTraversing } = useGraph();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GraphNodeData[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Debounced search
  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          setShowResults(data.length > 0);
        }
      } catch (err) {
        console.error("Search error:", err);
      }
      setSelectedIndex(-1);
    }, 200);
  }, []);

  useEffect(() => {
    search(query);
  }, [query, search]);

  // Keyboard nav
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      addSeed(results[selectedIndex]);
      setQuery("");
      setShowResults(false);
    } else if (e.key === "Escape") {
      setShowResults(false);
      inputRef.current?.blur();
    }
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="w-80 h-full glass-subtle flex flex-col border-r border-[var(--glass-border)] overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-[var(--glass-border)]">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-[var(--brand-primary)] animate-breathe" />
          <h2
            className="text-sm font-semibold text-[var(--fg-primary)] tracking-wide uppercase"
            style={{ fontFamily: "var(--font-outfit)" }}
          >
            Finder
          </h2>
        </div>
        <p className="text-xs text-[var(--fg-muted)]">
          Search nodes and seed the graph traversal
        </p>
      </div>

      {/* Search */}
      <div className="p-4 relative" ref={resultsRef}>
        <div className="search-input flex items-center gap-3 px-4 py-3">
          {/* Search icon */}
          <svg
            className="w-4 h-4 text-[var(--fg-muted)] shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search nodes..."
            className="flex-1 bg-transparent text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] outline-none"
          />
          {query && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              onClick={() => { setQuery(""); setShowResults(false); }}
              className="w-5 h-5 rounded-full bg-[var(--bg-hover)] flex items-center justify-center text-[var(--fg-muted)] hover:text-[var(--fg-primary)] transition-colors"
            >
              <span className="text-xs">✕</span>
            </motion.button>
          )}
          {isTraversing && (
            <div className="w-4 h-4 border-2 border-[var(--brand-primary)]/30 border-t-[var(--brand-primary)] rounded-full animate-spin" />
          )}
        </div>

        {/* Autocomplete Results */}
        <AnimatePresence>
          {showResults && results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute left-4 right-4 top-[68px] glass rounded-xl overflow-hidden z-50 shadow-2xl"
            >
              {results.map((result, i) => {
                const typeInfo = TYPE_ICONS[result.type] || { icon: "◉", color: "#888" };
                const isSelected = i === selectedIndex;
                return (
                  <motion.button
                    key={result.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.2 }}
                    onClick={() => {
                      addSeed(result);
                      setQuery("");
                      setShowResults(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150 ${
                      isSelected
                        ? "bg-[var(--bg-hover)]"
                        : "hover:bg-[var(--bg-hover)]"
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0"
                      style={{
                        background: `${typeInfo.color}15`,
                        border: `1px solid ${typeInfo.color}30`,
                      }}
                    >
                      {typeInfo.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--fg-primary)] truncate">{result.label}</p>
                      <p className="text-[10px] text-[var(--fg-muted)] capitalize">{result.type}</p>
                    </div>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: isSelected ? 1 : 0 }}
                      className="w-5 h-5 rounded-full bg-[var(--brand-primary)]/20 flex items-center justify-center"
                    >
                      <span className="text-[10px] text-[var(--brand-primary)]">+</span>
                    </motion.div>
                  </motion.button>
                );
              })}
              <div className="px-4 py-2 border-t border-[var(--glass-border)]">
                <p className="text-[10px] text-[var(--fg-muted)]">
                  ↑↓ Navigate · Enter to add · Esc to close
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Active Seeds */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-[var(--fg-secondary)] uppercase tracking-wider">
            Active Seeds ({seeds.length})
          </h3>
          {seeds.length > 0 && (
            <button
              onClick={clearSeeds}
              className="text-[10px] text-[var(--fg-muted)] hover:text-[var(--hot)] transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {seeds.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8"
          >
            <div className="text-3xl mb-3 opacity-30">🔍</div>
            <p className="text-xs text-[var(--fg-muted)] leading-relaxed">
              Search for nodes above or click<br />nodes in the graph to add seeds
            </p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {seeds.map((seed) => {
                const typeInfo = TYPE_ICONS[seed.type] || { icon: "◉", color: "#888" };
                return (
                  <motion.div
                    key={seed.id}
                    layout
                    initial={{ opacity: 0, scale: 0.8, x: -20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.8, x: 20 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--glass-border)] hover:border-[rgba(96,212,200,0.2)] transition-all duration-300 group"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                      style={{
                        background: `${typeInfo.color}15`,
                        border: `1px solid ${typeInfo.color}25`,
                      }}
                    >
                      {typeInfo.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--fg-primary)] truncate font-medium">{seed.label}</p>
                      <p className="text-[10px] text-[var(--fg-muted)] capitalize">{seed.type}</p>
                    </div>
                    <button
                      onClick={() => removeSeed(seed.id)}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--fg-muted)] opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-hover)] hover:text-[var(--hot)] transition-all duration-200"
                    >
                      <span className="text-xs">✕</span>
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Bottom section — Temperature Legend */}
      <div className="p-4 border-t border-[var(--glass-border)]">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[10px] text-[var(--fg-muted)] uppercase tracking-wider font-medium">Temperature</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-[var(--cold)]">Cold</span>
          <div className="flex-1 h-2 rounded-full temp-gradient" />
          <span className="text-[10px] text-[var(--hot)]">Hot</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            { label: "Cold", range: "0 – 0.3", color: "var(--cold)" },
            { label: "Warm", range: "0.3 – 0.6", color: "var(--warm)" },
            { label: "Hot", range: "0.6 – 1.0", color: "var(--hot)" },
          ].map((t) => (
            <div key={t.label} className="text-center">
              <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{ backgroundColor: t.color }} />
              <p className="text-[10px] font-medium" style={{ color: t.color }}>{t.label}</p>
              <p className="text-[9px] text-[var(--fg-muted)] font-mono">{t.range}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
