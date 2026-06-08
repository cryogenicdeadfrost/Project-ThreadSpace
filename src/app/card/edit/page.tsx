"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getOrCreateCard,
  updateCardProfile,
  saveCardNodes,
  updateCardVisibility,
} from "@/app/actions/card";

/* ================================================================
   THREADSPACE — Identity Card Editor
   Multi-step form · Premium animations · Glassmorphism
   ================================================================ */

const STEPS = [
  { id: "profile", label: "Profile", icon: "👤", desc: "Name & avatar" },
  { id: "shows", label: "Shows", icon: "📺", desc: "Your favorites" },
  { id: "characters", label: "Characters", icon: "🎭", desc: "Who you love" },
  { id: "traits", label: "Traits", icon: "✦", desc: "Your personality" },
  { id: "visibility", label: "Publish", icon: "🌐", desc: "Go live" },
];

// Predefined suggestions
const SHOW_SUGGESTIONS = [
  "The Office", "Parks & Rec", "Breaking Bad", "Friends", "Stranger Things",
  "Ben 10", "Avatar: TLA", "Naruto", "One Piece", "Attack on Titan",
  "Game of Thrones", "The Mandalorian", "Brooklyn Nine-Nine", "Suits",
  "How I Met Your Mother", "Seinfeld", "The Good Place", "Better Call Saul",
];

const CHARACTER_SUGGESTIONS = [
  "Jim Halpert", "Michael Scott", "Leslie Knope", "Walter White",
  "Chandler Bing", "Eleven", "Ben Tennyson", "Aang", "Zuko",
  "Naruto Uzumaki", "Monkey D. Luffy", "Levi Ackerman", "Jake Peralta",
  "Harvey Specter", "Ted Mosby", "Eleanor Shellstrop",
];

const TRAIT_SUGGESTIONS = [
  "Sarcasm", "Dry Humor", "Optimism", "Strategic Thinking", "Leadership",
  "Introvert", "Extrovert", "Creative", "Analytical", "Empathetic",
  "Adventurous", "Curious", "Loyal", "Nerdy", "Ambitious", "Calm",
  "INTJ", "ENFP", "INFP", "ENTP", "ISFJ", "INTP",
];

const ANIMAL_SUGGESTIONS = [
  "Dog", "Cat", "Rabbit", "Panther", "Wolf", "Owl", "Lion", "Panda", "Fox", "Bear", "Eagle"
];

// ── Tag Input Component ──────────────────────────────────────────
function TagInput({
  tags,
  setTags,
  suggestions,
  placeholder,
  label,
  isAsyncShows = false,
  isAsyncMusic = false,
}: {
  tags: string[];
  setTags: (t: string[]) => void;
  suggestions: string[];
  placeholder: string;
  label: string;
  isAsyncShows?: boolean;
  isAsyncMusic?: boolean;
}) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [asyncSuggestions, setAsyncSuggestions] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const apiCache = useRef<Record<string, string[]>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced API search with caching
  useEffect(() => {
    const isAsync = isAsyncShows || isAsyncMusic;
    if (!isAsync || !input.trim()) {
      setAsyncSuggestions([]);
      return;
    }

    const cacheKey = `${isAsyncShows ? "shows" : "music"}:${input.trim().toLowerCase()}`;
    if (apiCache.current[cacheKey]) {
      setAsyncSuggestions(apiCache.current[cacheKey]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setSearching(true);
      try {
        if (isAsyncShows) {
          const response = await fetch(
            `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(input.trim())}`
          );
          if (response.ok) {
            const data = await response.json();
            const names: string[] = data
              .map((item: any) => item.show?.name)
              .filter((name: string) => name && !tags.includes(name));
            const uniqueNames = Array.from(new Set(names)).slice(0, 6);
            apiCache.current[cacheKey] = uniqueNames;
            setAsyncSuggestions(uniqueNames);
          }
        } else if (isAsyncMusic) {
          const response = await fetch(
            `https://itunes.apple.com/search?term=${encodeURIComponent(input.trim())}&media=music&limit=10`
          );
          if (response.ok) {
            const data = await response.json();
            const songNames: string[] = (data.results || [])
              .map((item: any) => {
                const track = item.trackName;
                const artist = item.artistName;
                return track && artist ? `${track} - ${artist}` : "";
              })
              .filter((name: string) => name && !tags.includes(name));
            const uniqueSongs = Array.from(new Set(songNames)).slice(0, 6);
            apiCache.current[cacheKey] = uniqueSongs;
            setAsyncSuggestions(uniqueSongs);
          }
        }
      } catch (err) {
        console.error("Failed to fetch autocomplete suggestions:", err);
      } finally {
        setSearching(false);
      }
    }, 200); // Snappy 200ms debounce!

    return () => clearTimeout(delayDebounce);
  }, [input, isAsyncShows, isAsyncMusic, tags]);

  // Determine which suggestions to display
  const isAsync = isAsyncShows || isAsyncMusic;
  const displaySuggestions = isAsync && input.trim()
    ? asyncSuggestions
    : suggestions.filter(
        (s) => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s)
      ).slice(0, 6);

  const addTag = (tag: string) => {
    if (!tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setInput("");
    setShowSuggestions(false);
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  return (
    <div>
      <label className="block text-xs text-[var(--fg-secondary)] mb-2 font-medium">
        {label}
      </label>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-3">
        <AnimatePresence mode="popLayout">
          {tags.map((tag) => (
            <motion.span
              key={tag}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/20 text-xs text-[var(--brand-primary)] font-medium"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="w-4 h-4 rounded-full hover:bg-[var(--brand-primary)]/20 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div ref={containerRef} className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              e.preventDefault();
              addTag(input.trim());
            }
          }}
          placeholder={placeholder}
          className="w-full px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--fg-primary)] text-sm placeholder:text-[var(--fg-muted)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-glow)] transition-all duration-300"
        />

        {/* Suggestions dropdown */}
        <AnimatePresence>
          {showSuggestions && (searching || displaySuggestions.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 right-0 top-full mt-2 glass rounded-xl overflow-hidden z-30 shadow-xl"
            >
              {searching ? (
                <div className="px-4 py-3 text-xs text-[var(--fg-muted)] flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-[var(--brand-primary)]/20 border-t-[var(--brand-primary)] rounded-full animate-spin" />
                  <span>Searching databases...</span>
                </div>
              ) : (
                displaySuggestions.map((s, i) => (
                  <motion.button
                    key={s}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => addTag(s)}
                    className="w-full text-left px-4 py-2.5 text-sm text-[var(--fg-primary)] hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-between"
                  >
                    <span>{s}</span>
                    <span className="text-[10px] text-[var(--fg-muted)]">+ Add</span>
                  </motion.button>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Gradient Avatar Generator ────────────────────────────────────
function GradientAvatar({ name, size = 80 }: { name: string; size?: number }) {
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
      className="rounded-2xl flex items-center justify-center font-bold text-white/90 shadow-lg"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hue1}, 70%, 45%), hsl(${hue2}, 60%, 55%))`,
        fontSize: size * 0.35,
        fontFamily: "var(--font-outfit)",
      }}
    >
      {initials || "?"}
    </div>
  );
}

// ── Main Editor ──────────────────────────────────────────────────
export default function CardEditorPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [shows, setShows] = useState<string[]>([]);
  const [music, setMusic] = useState<string[]>([]);
  const [animals, setAnimals] = useState<string[]>([]);
  const [characters, setCharacters] = useState<string[]>([]);
  const [traits, setTraits] = useState<string[]>([]);
  const [beachOrMountain, setBeachOrMountain] = useState<"beach" | "mountain" | "">("");
  const [visibility, setVisibility] = useState<"public" | "private" | "friends_only">("public");
  const [direction, setDirection] = useState(1);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCard() {
      try {
        const data = await getOrCreateCard();
        setDisplayName(data.card.displayName || "");
        setBio(data.card.bio || "");
        
        const loadedMusic = data.shows.filter((s: string) => s.includes(" - "));
        const loadedShows = data.shows.filter((s: string) => !s.includes(" - "));
        setShows(loadedShows);
        setMusic(loadedMusic);

        setCharacters(data.characters);

        const hasBeach = data.traits.includes("Beach Person");
        const hasMountain = data.traits.includes("Mountain Person");
        setBeachOrMountain(hasBeach ? "beach" : hasMountain ? "mountain" : "");

        const loadedAnimals = data.traits.filter((t: string) => ANIMAL_SUGGESTIONS.includes(t));
        const loadedTraits = data.traits.filter(
          (t: string) => !ANIMAL_SUGGESTIONS.includes(t) && t !== "Beach Person" && t !== "Mountain Person"
        );
        setAnimals(loadedAnimals);
        setTraits(loadedTraits);

        setVisibility(data.card.visibility);
      } catch (err) {
        setError("Failed to load your identity card. Please sign in.");
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    loadCard();
  }, [router]);

  const getAccumulatedNodes = () => {
    const combinedShows = [...shows, ...music];
    const combinedTraits = [
      ...traits,
      ...animals,
      ...(beachOrMountain === "beach"
        ? ["Beach Person"]
        : beachOrMountain === "mountain"
        ? ["Mountain Person"]
        : []),
    ];
    return { combinedShows, combinedTraits };
  };

  const next = async () => {
    if (step < STEPS.length - 1) {
      setError("");
      setSaving(true);
      try {
        if (step === 0) {
          if (!displayName.trim()) {
            throw new Error("Display Name is required.");
          }
          await updateCardProfile(displayName, bio);
        } else {
          const { combinedShows, combinedTraits } = getAccumulatedNodes();
          await saveCardNodes(combinedShows, characters, combinedTraits);
        }
        setDirection(1);
        setStep(step + 1);
      } catch (err: any) {
        setError(err.message || "Failed to save progress. Please try again.");
      } finally {
        setSaving(false);
      }
    }
  };

  const back = () => {
    if (step > 0) {
      setError("");
      setDirection(-1);
      setStep(step - 1);
    }
  };

  const publish = async () => {
    setError("");
    setSaving(true);
    try {
      if (!displayName.trim()) {
        throw new Error("Display Name is required.");
      }
      const { combinedShows, combinedTraits } = getAccumulatedNodes();
      await updateCardProfile(displayName, bio);
      await saveCardNodes(combinedShows, characters, combinedTraits);
      await updateCardVisibility(visibility);
      router.push("/explore");
    } catch (err: any) {
      setError(err.message || "Failed to publish card. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const { combinedShows, combinedTraits } = getAccumulatedNodes();
  const totalItems = combinedShows.length + characters.length + combinedTraits.length;

  const variants = {
    enter: (d: number) => ({ x: d * 50, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d * -50, opacity: 0 }),
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="fixed inset-0 bg-mesh pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[var(--brand-primary)]/20 border-t-[var(--brand-primary)] rounded-full animate-spin" />
          <p className="text-sm text-[var(--fg-secondary)] font-medium">Loading your identity...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="fixed inset-0 bg-mesh pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-2xl"
      >
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ec4899] to-[#c084fc] flex items-center justify-center">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <span
              className="text-sm font-semibold text-[var(--fg-primary)]"
              style={{ fontFamily: "var(--font-outfit)" }}
            >
              ThreadSpace
            </span>
          </Link>
          <span className="text-xs text-[var(--fg-muted)] font-mono">
            {totalItems} nodes added
          </span>
        </div>

        <div className="flex items-center gap-1 mb-8">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => {
                if (i < step) {
                  setDirection(-1);
                  setStep(i);
                }
              }}
              disabled={i >= step}
              className={`flex-1 group ${i < step ? "cursor-pointer" : "cursor-default"}`}
            >
              <div className="flex items-center gap-1.5 mb-2 justify-center">
                <span className={`text-sm ${i <= step ? "opacity-100" : "opacity-30"} transition-opacity duration-300`}>
                  {s.icon}
                </span>
                <span className={`text-[10px] font-medium hidden md:inline ${
                  i === step ? "text-[var(--brand-primary)]" : i < step ? "text-[var(--fg-secondary)]" : "text-[var(--fg-muted)]"
                } transition-colors duration-300`}>
                  {s.label}
                </span>
              </div>
              <div className="h-1 rounded-full overflow-hidden bg-[var(--bg-surface)]">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#ec4899] to-[#c084fc]"
                  initial={false}
                  animate={{
                    width: i < step ? "100%" : i === step ? "50%" : "0%",
                  }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </button>
          ))}
        </div>

        <div className="glass rounded-2xl p-8 min-h-[400px] relative overflow-hidden">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-[var(--hot)]">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {step === 0 && (
                <div>
                  <h2 className="text-xl font-bold mb-1" style={{ fontFamily: "var(--font-outfit)" }}>
                    Your Identity
                  </h2>
                  <p className="text-sm text-[var(--fg-secondary)] mb-6">
                    This is how others will see you in the graph
                  </p>

                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-6">
                    <GradientAvatar name={displayName || "?"} />
                    <div className="flex-1 w-full space-y-4">
                      <div>
                        <label htmlFor="displayName" className="block text-xs text-[var(--fg-secondary)] mb-1.5 font-medium">
                          Display Name
                        </label>
                        <input
                          id="displayName"
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Your name or alias"
                          className="w-full px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--fg-primary)] text-sm placeholder:text-[var(--fg-muted)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-glow)] transition-all duration-300"
                        />
                      </div>
                      <div>
                        <label htmlFor="bio" className="block text-xs text-[var(--fg-secondary)] mb-1.5 font-medium">
                          Short Bio
                        </label>
                        <textarea
                          id="bio"
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder="A sentence about yourself..."
                          rows={2}
                          className="w-full px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--fg-primary)] text-sm placeholder:text-[var(--fg-muted)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-glow)] transition-all duration-300 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div>
                  <h2 className="text-xl font-bold mb-1" style={{ fontFamily: "var(--font-outfit)" }}>
                    Favorite Movies, Shows & Anime
                  </h2>
                  <p className="text-sm text-[var(--fg-secondary)] mb-6">
                    Each movie, show, or anime becomes a node in your discovery graph
                  </p>
                  <TagInput
                    tags={shows}
                    setTags={setShows}
                    suggestions={SHOW_SUGGESTIONS}
                    placeholder="Search movie, show, or anime name..."
                    label="Shows, Movies & Anime"
                    isAsyncShows={true}
                  />
                </div>
              )}

              {step === 2 && (
                <div>
                  <h2 className="text-xl font-bold mb-1" style={{ fontFamily: "var(--font-outfit)" }}>
                    Favorite Music
                  </h2>
                  <p className="text-sm text-[var(--fg-secondary)] mb-6">
                    Add your favorite tracks or artists (powered by iTunes Search)
                  </p>
                  <TagInput
                    tags={music}
                    setTags={setMusic}
                    suggestions={[]}
                    placeholder="Search songs or artists..."
                    label="Tracks & Artists"
                    isAsyncMusic={true}
                  />
                </div>
              )}

              {step === 3 && (
                <div>
                  <h2 className="text-xl font-bold mb-1" style={{ fontFamily: "var(--font-outfit)" }}>
                    Favorite Animals & Pets
                  </h2>
                  <p className="text-sm text-[var(--fg-secondary)] mb-6">
                    Select your spirit animals or pets — prebuilt or custom options
                  </p>
                  <TagInput
                    tags={animals}
                    setTags={setAnimals}
                    suggestions={ANIMAL_SUGGESTIONS}
                    placeholder="Type an animal or choose from suggestions..."
                    label="Animals & Pets"
                  />
                </div>
              )}

              {step === 4 && (
                <div>
                  <h2 className="text-xl font-bold mb-1" style={{ fontFamily: "var(--font-outfit)" }}>
                    Personality & Preferences
                  </h2>
                  <p className="text-sm text-[var(--fg-secondary)] mb-6">
                    Choose your preferences and MBTI traits to link them together
                  </p>

                  <div className="mb-6">
                    <label className="block text-xs text-[var(--fg-secondary)] mb-2 font-medium">
                      Beach or Mountain Person?
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setBeachOrMountain(beachOrMountain === "beach" ? "" : "beach")}
                        className={`py-3 rounded-xl border font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
                          beachOrMountain === "beach"
                            ? "bg-[var(--brand-primary)]/10 border-[var(--brand-primary)]/40 text-[var(--brand-primary)]"
                            : "bg-[var(--bg-surface)] border-[var(--glass-border)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]"
                        }`}
                      >
                        🏖️ Beach Person
                      </button>
                      <button
                        type="button"
                        onClick={() => setBeachOrMountain(beachOrMountain === "mountain" ? "" : "mountain")}
                        className={`py-3 rounded-xl border font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
                          beachOrMountain === "mountain"
                            ? "bg-[var(--brand-primary)]/10 border-[var(--brand-primary)]/40 text-[var(--brand-primary)]"
                            : "bg-[var(--bg-surface)] border-[var(--glass-border)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]"
                        }`}
                      >
                        🏔️ Mountain Person
                      </button>
                    </div>
                  </div>

                  <TagInput
                    tags={traits}
                    setTags={setTraits}
                    suggestions={TRAIT_SUGGESTIONS}
                    placeholder="Type personality traits or pick suggestions..."
                    label="Personality Traits"
                  />
                </div>
              )}

              {step === 5 && (
                <div>
                  <h2 className="text-xl font-bold mb-1" style={{ fontFamily: "var(--font-outfit)" }}>
                    Ready to Publish?
                  </h2>
                  <p className="text-sm text-[var(--fg-secondary)] mb-6">
                    Choose who can discover your card in the graph
                  </p>

                  <div className="glass rounded-xl p-5 mb-6 border border-[var(--brand-primary)]/10">
                    <div className="flex items-center gap-4 mb-4">
                      <GradientAvatar name={displayName || "?"} size={48} />
                      <div>
                        <h3 className="font-semibold text-[var(--fg-primary)]">
                          {displayName || "Anonymous"}
                        </h3>
                        <p className="text-xs text-[var(--fg-muted)]">{bio || "No bio yet"}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[...shows, ...music, ...characters, ...traits, ...animals, ...(beachOrMountain ? [beachOrMountain === "beach" ? "Beach Person" : "Mountain Person"] : [])].map((item) => (
                        <span
                          key={item}
                          className="px-2 py-0.5 rounded-full bg-[var(--brand-primary)]/10 text-[10px] text-[var(--brand-primary)]"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-[var(--fg-muted)] mt-3">
                      {totalItems} nodes · {shows.length} shows · {music.length} songs · {characters.length} characters · {traits.length} traits
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs text-[var(--fg-secondary)] mb-2 font-medium">
                      Card Visibility
                    </label>
                    {(["public", "friends_only", "private"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setVisibility(v)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${
                          visibility === v
                            ? "bg-[var(--brand-primary)]/10 border-[var(--brand-primary)]/30"
                            : "bg-[var(--bg-surface)] border-[var(--glass-border)] hover:border-[rgba(236,72,153,0.15)]"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            visibility === v ? "border-[var(--brand-primary)]" : "border-[var(--fg-muted)]"
                          }`}
                        >
                          {visibility === v && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-2 h-2 rounded-full bg-[var(--brand-primary)]"
                            />
                          )}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-[var(--fg-primary)] capitalize">
                            {v.replace("_", " ")}
                          </p>
                          <p className="text-[10px] text-[var(--fg-muted)]">
                            {v === "public"
                              ? "Anyone can discover your card in the graph"
                              : v === "friends_only"
                              ? "Only people with your challenge link can find you"
                              : "Your card is hidden until you publish it"}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between mt-6">
          <button
            onClick={back}
            disabled={step === 0 || saving}
            className="px-5 py-2.5 rounded-xl text-sm text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Back
          </button>
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  i === step
                    ? "w-4 bg-[var(--brand-primary)]"
                    : i < step
                    ? "bg-[var(--brand-primary)]/40"
                    : "bg-[var(--fg-muted)]/30"
                }`}
              />
            ))}
          </div>
          {step < STEPS.length - 1 ? (
            <button
              onClick={next}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-sm bg-gradient-to-r from-[#ec4899] to-[#c084fc] text-white font-semibold hover:shadow-[0_0_20px_rgba(236,72,153,0.25)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {saving ? "Saving..." : "Next →"}
            </button>
          ) : (
            <button
              onClick={publish}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm bg-gradient-to-r from-[#ec4899] via-[#c084fc] to-[#60d4c8] text-white font-semibold hover:shadow-[0_0_24px_rgba(236,72,153,0.3)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <div className="w-3.5 h-3.5 border-white/30 border-t-white border-2 rounded-full animate-spin" />}
              🚀 {saving ? "Publishing..." : "Publish Card"}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
