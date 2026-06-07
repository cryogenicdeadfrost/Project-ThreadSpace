"use client";

import { useTheme } from "next-themes";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

export function speakText(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

export function AccessibilityMenu() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [audioAssist, setAudioAssist] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Sync state on mount
  useEffect(() => {
    setMounted(true);

    const textPref = localStorage.getItem("accessibility-text") === "true";
    const contrastPref = localStorage.getItem("accessibility-contrast") === "true";
    const motionPref = localStorage.getItem("accessibility-motion") === "true";
    const audioPref = localStorage.getItem("accessibility-audio") === "true";

    setLargeText(textPref);
    setHighContrast(contrastPref);
    setReducedMotion(motionPref);
    setAudioAssist(audioPref);

    if (textPref) document.documentElement.classList.add("text-large");
    if (contrastPref) document.documentElement.classList.add("high-contrast");
    if (motionPref) document.documentElement.classList.add("reduced-motion");
    if (audioPref) document.documentElement.dataset.audioAssist = "true";
  }, []);

  // Handle click outside to close popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!mounted) return <div className="w-8 h-8" />;

  const toggleLargeText = () => {
    const nextVal = !largeText;
    setLargeText(nextVal);
    localStorage.setItem("accessibility-text", String(nextVal));
    if (nextVal) {
      document.documentElement.classList.add("text-large");
      if (audioAssist) speakText("Large text enabled");
    } else {
      document.documentElement.classList.remove("text-large");
      if (audioAssist) speakText("Normal text restored");
    }
  };

  const toggleHighContrast = () => {
    const nextVal = !highContrast;
    setHighContrast(nextVal);
    localStorage.setItem("accessibility-contrast", String(nextVal));
    if (nextVal) {
      document.documentElement.classList.add("high-contrast");
      if (audioAssist) speakText("High contrast mode enabled");
    } else {
      document.documentElement.classList.remove("high-contrast");
      if (audioAssist) speakText("Normal contrast restored");
    }
  };

  const toggleReducedMotion = () => {
    const nextVal = !reducedMotion;
    setReducedMotion(nextVal);
    localStorage.setItem("accessibility-motion", String(nextVal));
    if (nextVal) {
      document.documentElement.classList.add("reduced-motion");
      if (audioAssist) speakText("Reduced motion enabled");
    } else {
      document.documentElement.classList.remove("reduced-motion");
      if (audioAssist) speakText("Standard motion restored");
    }
  };

  const toggleAudioAssist = () => {
    const nextVal = !audioAssist;
    setAudioAssist(nextVal);
    localStorage.setItem("accessibility-audio", String(nextVal));
    if (nextVal) {
      document.documentElement.dataset.audioAssist = "true";
      speakText("Audio assist screen reader enabled");
    } else {
      delete document.documentElement.dataset.audioAssist;
      speakText("Audio assist disabled");
    }
  };

  return (
    <div ref={menuRef} className="relative inline-block text-left z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 flex items-center justify-center rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--glass-border)] text-sm transition-all duration-300 pointer-events-auto shadow-md"
        title="Accessibility Settings"
        aria-label="Accessibility Settings"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        ♿
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 5 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 mt-2 w-64 glass rounded-2xl p-4 shadow-xl z-50 border border-[var(--glass-border)]"
            role="menu"
            aria-label="Accessibility Options"
          >
            <h3 className="text-xs font-bold text-[var(--fg-primary)] mb-3 tracking-wide uppercase font-mono">
              Accessibility Settings
            </h3>
            <div className="space-y-3">
              {/* Theme Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[var(--fg-primary)]">Light / Dark theme</p>
                  <p className="text-[10px] text-[var(--fg-muted)]">Toggle background colors</p>
                </div>
                <button
                  onClick={() => {
                    const nextTheme = theme === "dark" ? "light" : "dark";
                    setTheme(nextTheme);
                    if (audioAssist) speakText(`Switched to ${nextTheme} mode`);
                  }}
                  className="px-2 py-1 rounded-lg bg-[var(--bg-hover)] border border-[var(--glass-border)] text-xs text-[var(--fg-primary)] hover:border-[var(--brand-primary)]/40 transition-all font-medium"
                >
                  {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
                </button>
              </div>

              {/* Text Sizing */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[var(--fg-primary)]">Large Text Sizing</p>
                  <p className="text-[10px] text-[var(--fg-muted)]">Scale all screen typography</p>
                </div>
                <button
                  onClick={toggleLargeText}
                  className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-300 relative focus:outline-none ${
                    largeText ? "bg-[var(--brand-primary)]" : "bg-[var(--fg-muted)]"
                  }`}
                  aria-checked={largeText}
                  role="switch"
                  aria-label="Large Text Sizing"
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform duration-300 shadow ${
                      largeText ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* High Contrast */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[var(--fg-primary)]">High Contrast</p>
                  <p className="text-[10px] text-[var(--fg-muted)]">Maximize content contrast</p>
                </div>
                <button
                  onClick={toggleHighContrast}
                  className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-300 relative focus:outline-none ${
                    highContrast ? "bg-[var(--brand-primary)]" : "bg-[var(--fg-muted)]"
                  }`}
                  aria-checked={highContrast}
                  role="switch"
                  aria-label="High Contrast"
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform duration-300 shadow ${
                      highContrast ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Reduced Motion */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[var(--fg-primary)]">Reduced Motion</p>
                  <p className="text-[10px] text-[var(--fg-muted)]">Disable canvas physics bounciness</p>
                </div>
                <button
                  onClick={toggleReducedMotion}
                  className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-300 relative focus:outline-none ${
                    reducedMotion ? "bg-[var(--brand-primary)]" : "bg-[var(--fg-muted)]"
                  }`}
                  aria-checked={reducedMotion}
                  role="switch"
                  aria-label="Reduced Motion"
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform duration-300 shadow ${
                      reducedMotion ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Audio Assist (SpeechSynthesis) */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[var(--fg-primary)]">Audio Assist (TTS)</p>
                  <p className="text-[10px] text-[var(--fg-muted)]">Voice descriptions on click</p>
                </div>
                <button
                  onClick={toggleAudioAssist}
                  className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-300 relative focus:outline-none ${
                    audioAssist ? "bg-[var(--brand-primary)]" : "bg-[var(--fg-muted)]"
                  }`}
                  aria-checked={audioAssist}
                  role="switch"
                  aria-label="Audio Assist (TTS)"
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform duration-300 shadow ${
                      audioAssist ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
