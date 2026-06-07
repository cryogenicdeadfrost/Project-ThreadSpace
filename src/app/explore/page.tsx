"use client";

import { GraphProvider } from "@/components/graph/graph-provider";
import { GraphCanvas } from "@/components/graph/graph-canvas";
import { FinderRail } from "@/components/finder/finder-rail";
import { AccessibilityMenu } from "@/components/accessibility-menu";
import { motion } from "motion/react";
import Link from "next/link";

export default function ExplorePage() {
  return (
    <GraphProvider>
      <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg-deep)]">
        {/* Top bar */}
        <motion.header
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="h-14 flex items-center justify-between px-5 border-b border-[var(--glass-border)] glass-subtle shrink-0 z-20"
        >
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#60d4c8] to-[#38bdf8] flex items-center justify-center">
              <span className="text-[#05080f] font-bold text-xs">T</span>
            </div>
            <span
              className="text-sm font-semibold text-[var(--fg-primary)] tracking-tight"
              style={{ fontFamily: "var(--font-outfit)" }}
            >
              ThreadSpace
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--fg-muted)] font-mono uppercase tracking-wider">
              Graph Explorer
            </span>
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)] animate-breathe" />
          </div>

          <div className="flex items-center gap-3">
            <AccessibilityMenu />
            <Link
              href="/login"
              className="px-4 py-1.5 text-xs text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-4 py-1.5 text-xs rounded-full bg-gradient-to-r from-[#60d4c8] to-[#38bdf8] text-[#05080f] font-medium hover:shadow-[0_0_16px_rgba(96,212,200,0.25)] transition-all duration-300"
            >
              Create Identity
            </Link>
          </div>
        </motion.header>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Finder Rail (left sidebar) */}
          <motion.aside
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="shrink-0"
          >
            <FinderRail />
          </motion.aside>

          {/* Graph Canvas (main area) */}
          <motion.main
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 relative"
          >
            <GraphCanvas />

            {/* Instruction overlay - fades away after interaction */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <motion.div
                initial={{ opacity: 0.8 }}
                animate={{ opacity: 0 }}
                transition={{ delay: 4, duration: 1.5 }}
                className="glass rounded-2xl px-6 py-4 text-center"
              >
                <p className="text-sm text-[var(--fg-secondary)]">
                  🖱️ Hover to explore · Click to select · Drag to move · Scroll to zoom
                </p>
              </motion.div>
            </div>
          </motion.main>
        </div>
      </div>
    </GraphProvider>
  );
}
