"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { createChallengeLink } from "@/app/actions/challenge";

interface NodeItem {
  id: string;
  type: string;
  slug: string;
  displayName: string;
}

export function ChallengeModal({ associatedNodes }: { associatedNodes: NodeItem[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [challengeUrl, setChallengeUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const toggleNode = (id: string) => {
    setError("");
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((i) => i !== id);
      }
      if (prev.length >= 3) {
        setError("You can select at most 3 clue nodes.");
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleGenerate = async () => {
    if (selectedIds.length !== 3) {
      setError("Please select exactly 3 clue nodes.");
      return;
    }

    setGenerating(true);
    setError("");
    try {
      const linkId = await createChallengeLink(selectedIds);
      const url = window.location.origin + "/challenge/" + linkId;
      setChallengeUrl(url);
    } catch (err: any) {
      setError(err.message || "Failed to generate challenge link.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(challengeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy to clipboard. Please copy manually.");
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedIds([]);
    setChallengeUrl("");
    setCopied(false);
    setError("");
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#60d4c8] to-[#38bdf8] text-[#05080f] hover:shadow-[0_0_20px_rgba(96,212,200,0.3)] transition-all duration-300 flex items-center gap-1.5"
      >
        🔗 Generate Challenge Link
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md glass rounded-3xl p-6 sm:p-8 border border-[var(--glass-border)] bg-[#05080f]/95 text-left relative overflow-hidden"
            >
              <div className="flex justify-between items-center mb-5 border-b border-[var(--glass-border)] pb-4">
                <h3 className="text-lg font-bold text-[var(--fg-primary)] flex items-center gap-2" style={{ fontFamily: "var(--font-outfit)" }}>
                  🎮 Share Challenge Link
                </h3>
                <button
                  onClick={handleClose}
                  className="w-6 h-6 rounded-full bg-[var(--bg-hover)] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] flex items-center justify-center transition-colors text-xs"
                >
                  ✕
                </button>
              </div>

              {challengeUrl ? (
                // Success screen / display link
                <div className="space-y-5 py-2">
                  <div className="w-12 h-12 rounded-2xl bg-[rgba(96,212,200,0.1)] border border-[var(--brand-primary)]/20 flex items-center justify-center mx-auto text-xl animate-bounce">
                    🎉
                  </div>
                  <div className="text-center">
                    <h4 className="font-semibold text-sm text-[var(--fg-primary)] mb-1">
                      Challenge Link Generated!
                    </h4>
                    <p className="text-xs text-[var(--fg-muted)]">
                      Finders can guess your profile details by starting from your clue nodes.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 p-3 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl">
                    <input
                      type="text"
                      readOnly
                      value={challengeUrl}
                      className="flex-1 bg-transparent text-xs text-[var(--fg-primary)] outline-none overflow-x-auto truncate"
                    />
                    <button
                      onClick={handleCopy}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                        copied
                          ? "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]"
                          : "bg-gradient-to-r from-[#60d4c8] to-[#38bdf8] text-[#05080f]"
                      }`}
                    >
                      {copied ? "Copied! ✓" : "Copy"}
                    </button>
                  </div>

                  <p className="text-[10px] text-center text-[var(--fg-muted)]">
                    This link is valid for 72 hours.
                  </p>
                </div>
              ) : (
                // Select clues screen
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--fg-secondary)] uppercase tracking-wider mb-1 font-mono">
                      Step 1: Select 3 Clues
                    </h4>
                    <p className="text-xs text-[var(--fg-muted)] leading-relaxed">
                      Choose exactly 3 nodes from your card nodes. Finders will start their hunt with these clues highlighted in their explorer graph.
                    </p>
                  </div>

                  {associatedNodes.length < 3 ? (
                    <div className="text-center py-6 border border-dashed border-amber-500/20 rounded-2xl bg-amber-500/5 text-xs text-amber-400">
                      ⚠️ You must add at least 3 nodes to your card (shows, characters, or traits) before you can generate a challenge link.
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {associatedNodes.map((node) => {
                        const isSelected = selectedIds.includes(node.id);
                        return (
                          <button
                            key={node.id}
                            onClick={() => toggleNode(node.id)}
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all duration-300 ${
                              isSelected
                                ? "bg-[var(--brand-primary)]/10 border-[var(--brand-primary)]/30 text-[var(--fg-primary)]"
                                : "bg-[var(--bg-surface)] border-[var(--glass-border)] text-[var(--fg-secondary)] hover:border-white/10"
                            }`}
                          >
                            <span className="font-medium truncate">{node.displayName}</span>
                            <span className="text-[9px] text-[var(--fg-muted)] uppercase tracking-wider font-mono shrink-0 ml-2 bg-white/5 px-2 py-0.5 rounded-md">
                              {node.type}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {error && (
                    <p className="text-xs text-[var(--hot)] bg-[rgba(249,112,102,0.1)] rounded-lg px-3 py-2 border border-red-500/10">
                      {error}
                    </p>
                  )}

                  <div className="flex justify-between items-center text-[10px] text-[var(--fg-muted)]">
                    <span>Selected: {selectedIds.length} / 3</span>
                    <span>Required: exactly 3</span>
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={selectedIds.length !== 3 || generating}
                    className="w-full py-3 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#60d4c8] via-[#38bdf8] to-[#a78bfa] text-[#05080f] hover:shadow-[0_0_20px_rgba(96,212,200,0.3)] transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {generating && (
                      <div className="w-3.5 h-3.5 border-2 border-[#05080f]/30 border-t-[#05080f] rounded-full animate-spin" />
                    )}
                    {generating ? "Generating Challenge..." : "Generate Challenge Link"}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
