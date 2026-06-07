"use client";

import { useState, useEffect, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { GraphContext, type GraphNodeData, type GraphEdgeData, type ScoredCard } from "@/components/graph/graph-provider";
import { GraphCanvas } from "@/components/graph/graph-canvas";
import { FinderRail } from "@/components/finder/finder-rail";
import { ChallengeDetails, traverseChallenge } from "@/app/actions/challenge";

// Gradient Avatar Helper for the unlocked profile card
function GradientAvatar({ name, size = 64 }: { name: string; size?: number }) {
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue1 = hash % 360;
  const hue2 = (hash * 7) % 360;
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className="rounded-2xl flex items-center justify-center font-bold text-white shadow-md"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hue1}, 75%, 45%), hsl(${hue2}, 65%, 55%))`,
        fontSize: size * 0.35,
        fontFamily: "var(--font-outfit)",
      }}
    >
      {initials || "?"}
    </div>
  );
}

export function ChallengeClient({ challenge }: { challenge: ChallengeDetails }) {
  // Convert challenge clues to initial seeds
  const initialSeeds: GraphNodeData[] = challenge.clues.map((c) => ({
    id: c.id,
    label: c.displayName,
    type: c.type as any,
    score: 1.0,
    temperature: "hot",
    slug: c.slug,
  }));

  const [seeds, setSeeds] = useState<GraphNodeData[]>(initialSeeds);
  const [graphNodes, setGraphNodes] = useState<GraphNodeData[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdgeData[]>([]);
  const [scoredCards, setScoredCards] = useState<ScoredCard[]>([]);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [traversalHistory, setTraversalHistory] = useState<string[][]>([]);
  const [isTraversing, setIsTraversing] = useState(false);

  // Challenge game specific state
  const [similarity, setSimilarity] = useState(0);
  const [won, setWon] = useState(false);
  const [targetProfile, setTargetProfile] = useState<{
    displayName: string;
    bio: string;
    avatarUrl: string | null;
    nodes: { id: string; displayName: string; type: string; slug: string }[];
  } | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  // Traverse on seeds change
  useEffect(() => {
    let active = true;
    async function fetchChallengeTraversal() {
      setIsTraversing(true);
      try {
        const seedIds = seeds.map((s) => s.id);
        const result = await traverseChallenge(challenge.id, seedIds);
        if (active) {
          setGraphNodes(result.nodes);
          setGraphEdges(result.edges);
          setSimilarity(result.similarity);
          
          if (result.won) {
            setWon(true);
            if (result.targetCard) {
              setTargetProfile(result.targetCard);
              setShowCelebration(true);
            }
          }
        }
      } catch (err) {
        console.error("Challenge traversal error:", err);
      } finally {
        if (active) setIsTraversing(false);
      }
    }
    fetchChallengeTraversal();
    return () => {
      active = false;
    };
  }, [seeds, challenge.id]);

  const addSeed = useCallback((node: GraphNodeData) => {
    setSeeds((prev) => {
      if (prev.find((s) => s.id === node.id)) return prev;
      return [...prev, node];
    });
  }, []);

  const removeSeed = useCallback((nodeId: string) => {
    // Keep clues as locked seeds (can't remove clues to prevent losing progress below starting point)
    const isClue = challenge.clues.some((c) => c.id === nodeId);
    if (isClue) return;
    setSeeds((prev) => prev.filter((s) => s.id !== nodeId));
  }, [challenge.clues]);

  const clearSeeds = useCallback(() => {
    // Revert to initial clues
    setSeeds(initialSeeds);
  }, [initialSeeds]);

  const pushTraversal = useCallback((path: string[]) => {
    setTraversalHistory((prev) => [...prev, path]);
  }, []);

  return (
    <GraphContext.Provider
      value={{
        seeds,
        addSeed,
        removeSeed,
        clearSeeds,
        graphNodes,
        graphEdges,
        setGraphNodes,
        setGraphEdges,
        scoredCards,
        setScoredCards,
        activeCardId,
        setActiveCardId,
        traversalHistory,
        pushTraversal,
        isTraversing,
        setIsTraversing: (v) => setIsTraversing(v),
      }}
    >
      <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg-deep)] relative">
        
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-5 border-b border-[var(--glass-border)] glass-subtle shrink-0 z-20">
          <Link href="/explore" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#60d4c8] to-[#38bdf8] flex items-center justify-center">
              <span className="text-[#05080f] font-bold text-xs">T</span>
            </div>
            <span className="text-sm font-semibold text-[var(--fg-primary)] tracking-tight font-outfit">
              ThreadSpace
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-400 uppercase tracking-widest font-mono">
              🎯 Challenge Hunt
            </div>
            <span className="text-xs text-[var(--fg-secondary)] font-medium">
              Find <strong className="text-[var(--fg-primary)]">{challenge.creatorName}</strong>
            </span>
          </div>

          <div>
            <Link
              href="/explore"
              className="text-xs font-semibold px-4 py-1.5 rounded-full border border-[var(--glass-border)] hover:bg-[var(--bg-hover)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] transition-all duration-300"
            >
              Exit Game
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden relative">
          
          {/* Left panel Finder Rail */}
          <aside className="shrink-0 z-10">
            <FinderRail />
          </aside>

          {/* Graph Canvas */}
          <main className="flex-1 relative">
            <GraphCanvas />
            
            {/* Game Instruction Overlay */}
            <div className="absolute top-4 left-4 pointer-events-none z-10 max-w-xs">
              <div className="glass rounded-2xl p-4 border border-[var(--glass-border)] bg-[#05080f]/75">
                <h4 className="text-xs font-bold text-[var(--fg-primary)] uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
                  🔑 Initial Clues
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {challenge.clues.map((c) => (
                    <span
                      key={c.id}
                      className="px-2 py-1 rounded-lg bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/20 text-[10px] text-[var(--brand-primary)] font-medium"
                    >
                      {c.displayName}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Game Progress Indicator Overlay */}
            <div className="absolute top-4 right-4 z-10 w-64 pointer-events-auto">
              <div className="glass rounded-2xl p-4 sm:p-5 border border-[var(--glass-border)] bg-[#05080f]/80 shadow-2xl">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-bold text-[var(--fg-secondary)] uppercase tracking-wider font-mono">
                    Discovery Meter
                  </h4>
                  <span className="text-xs font-mono font-bold text-[var(--brand-primary)]">
                    {Math.round(similarity * 100)}%
                  </span>
                </div>
                
                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-white/5 border border-white/10 overflow-hidden mb-3">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[#60d4c8] via-[#38bdf8] to-[#a78bfa]"
                    initial={{ width: 0 }}
                    animate={{ width: `${similarity * 100}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>

                {/* Status Guidance */}
                <p className="text-[10px] text-[var(--fg-muted)] leading-relaxed">
                  {similarity < 0.4
                    ? "❄️ Traversal is cold. Try pulling threads from the clues or searching for nearby nodes!"
                    : similarity < 0.7
                    ? "🔥 Getting warmer! You've located adjacent connections. Keep searching!"
                    : similarity < 0.85
                    ? "☀️ Extreme heat! Almost there, discover 1 or 2 more matching nodes to unlock the profile!"
                    : "🎉 Profile Unlocked! Challenge successfully solved!"}
                </p>
              </div>
            </div>
          </main>
        </div>

        {/* Win Celebration Modal */}
        <AnimatePresence>
          {showCelebration && targetProfile && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 20 }}
                className="w-full max-w-lg glass rounded-3xl p-8 sm:p-10 border border-[var(--brand-primary)]/20 bg-[#05080f]/95 shadow-[0_0_60px_rgba(96,212,200,0.15)] text-center relative overflow-hidden"
              >
                {/* Visual particles effects */}
                <div className="absolute -top-12 -left-12 w-48 h-48 bg-[var(--brand-primary)]/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-[#38bdf8]/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 space-y-6">
                  {/* Badge */}
                  <span className="px-3.5 py-1.5 rounded-full bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/25 text-[10px] font-bold text-[var(--brand-primary)] uppercase tracking-widest font-mono">
                    🏆 Target Found!
                  </span>

                  {/* Header */}
                  <div>
                    <h2 className="text-3xl font-extrabold text-[var(--fg-primary)] font-outfit">
                      Challenge Solved
                    </h2>
                    <p className="text-xs text-[var(--fg-secondary)] mt-1.5">
                      You successfully mapped the neighborhood of {challenge.creatorName}!
                    </p>
                  </div>

                  {/* Creator Unlocked Card */}
                  <div className="glass rounded-2xl p-5 border border-white/5 bg-[#05080f]/40 text-left space-y-4">
                    <div className="flex items-center gap-4">
                      <GradientAvatar name={targetProfile.displayName} size={56} />
                      <div>
                        <h3 className="text-lg font-bold text-[var(--fg-primary)] font-outfit">
                          {targetProfile.displayName}
                        </h3>
                        <p className="text-xs text-[var(--fg-secondary)] mt-0.5 line-clamp-2">
                          {targetProfile.bio || "This hider chooses to travel without a bio."}
                        </p>
                      </div>
                    </div>

                    <div className="h-px bg-white/5 my-3" />

                    <div>
                      <h4 className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider font-mono mb-2">
                        Mapped Nodes
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {targetProfile.nodes.map((n) => (
                          <span
                            key={n.id}
                            className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-[var(--fg-secondary)] font-medium hover:border-[var(--brand-primary)]/20 transition-all duration-300"
                          >
                            {n.displayName}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* CTAs */}
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <button
                      onClick={() => setShowCelebration(false)}
                      className="w-full py-3 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--glass-border)] text-[var(--fg-primary)] hover:bg-[var(--bg-hover)] transition-all"
                    >
                      Keep Looking at Canvas
                    </button>
                    <Link
                      href="/explore"
                      className="w-full py-3 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#60d4c8] via-[#38bdf8] to-[#a78bfa] text-[#05080f] hover:shadow-[0_0_20px_rgba(96,212,200,0.3)] transition-all duration-300 block text-center"
                    >
                      Explore General Graph
                    </Link>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </GraphContext.Provider>
  );
}
