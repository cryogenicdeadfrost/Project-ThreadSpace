import { db } from "@/lib/db";
import { identityCards, nodes, cardNodes } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { ChallengeModal } from "@/components/identity/challenge-modal";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Dynamic Metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const cards = await db
      .select()
      .from(identityCards)
      .where(eq(identityCards.id, id))
      .limit(1);

    const card = cards[0];
    if (!card) {
      return {
        title: "Card Not Found | ThreadSpace",
      };
    }

    return {
      title: `${card.displayName || "Anonymous"} | ThreadSpace Identity`,
      description: card.bio || `Explore the identity of ${card.displayName || "Anonymous"} on ThreadSpace.`,
      openGraph: {
        title: `${card.displayName || "Anonymous"} | ThreadSpace`,
        description: card.bio || `Explore their profile on the graph-native identity discovery platform.`,
      },
    };
  } catch {
    return {
      title: "ThreadSpace Identity",
    };
  }
}

// Gradient Avatar Generator helper
function GradientAvatar({ name, size = 96 }: { name: string; size?: number }) {
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
      className="rounded-3xl flex items-center justify-center font-bold text-white/95 shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-white/10"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hue1}, 75%, 45%), hsl(${hue2}, 65%, 55%))`,
        fontSize: size * 0.35,
      }}
    >
      {initials || "?"}
    </div>
  );
}

export default async function PublicCardPage({ params }: PageProps) {
  const { id } = await params;

  // 1. Fetch card details
  const cards = await db
    .select()
    .from(identityCards)
    .where(eq(identityCards.id, id))
    .limit(1);

  const card = cards[0];

  if (!card) {
    notFound();
  }

  // Enforce Privacy Policies to prevent data leaks
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const isOwner = session?.user && session.user.id === card.userId;

  if (card.visibility === "private" && !isOwner) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden bg-[#05080f]">
        <div className="fixed inset-0 bg-mesh pointer-events-none opacity-40" />
        <div className="relative z-10 w-full max-w-md">
          <div className="glass rounded-3xl p-8 border border-[rgba(255,255,255,0.06)] bg-[#05080f]/60 backdrop-blur-xl shadow-2xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6 text-2xl">
              🔒
            </div>
            <h1 className="text-xl font-bold text-[var(--fg-primary)] mb-2" style={{ fontFamily: "var(--font-outfit)" }}>
              Private Identity Card
            </h1>
            <p className="text-sm text-[var(--fg-muted)] mb-6">
              The owner of this card has set its visibility to Private. Only the owner can view this profile.
            </p>
            <Link
              href="/explore"
              className="inline-flex w-full items-center justify-center px-5 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#60d4c8] to-[#38bdf8] text-[#05080f] hover:shadow-[0_0_20px_rgba(96,212,200,0.3)] transition-all duration-300"
            >
              Go to Graph Explorer
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (card.visibility === "friends_only" && !session?.user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden bg-[#05080f]">
        <div className="fixed inset-0 bg-mesh pointer-events-none opacity-40" />
        <div className="relative z-10 w-full max-w-md">
          <div className="glass rounded-3xl p-8 border border-[rgba(255,255,255,0.06)] bg-[#05080f]/60 backdrop-blur-xl shadow-2xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6 text-2xl">
              👥
            </div>
            <h1 className="text-xl font-bold text-[var(--fg-primary)] mb-2" style={{ fontFamily: "var(--font-outfit)" }}>
              Restricted Profile
            </h1>
            <p className="text-sm text-[var(--fg-muted)] mb-6">
              This card is only visible to registered members on ThreadSpace. Please sign in to view this profile.
            </p>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center px-5 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#60d4c8] to-[#38bdf8] text-[#05080f] hover:shadow-[0_0_20px_rgba(96,212,200,0.3)] transition-all duration-300"
            >
              Sign In to View
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isPrivate = card.visibility === "private";
  const isFriendsOnly = card.visibility === "friends_only";

  // 2. Fetch associated nodes
  const associatedNodes = await db
    .select({
      id: nodes.id,
      type: nodes.type,
      slug: nodes.slug,
      displayName: nodes.displayName,
    })
    .from(cardNodes)
    .innerJoin(nodes, eq(cardNodes.nodeId, nodes.id))
    .where(eq(cardNodes.cardId, card.id));

  // Separate nodes by type
  const shows = associatedNodes.filter((n) => n.type === "show");
  const characters = associatedNodes.filter((n) => n.type === "character");
  const traits = associatedNodes.filter((n) => n.type === "trait");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden bg-[#05080f]">
      {/* Background visual effects */}
      <div className="fixed inset-0 bg-mesh pointer-events-none opacity-40" />
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[rgba(96,212,200,0.03)] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[rgba(56,189,248,0.03)] rounded-full blur-3xl pointer-events-none" />

      {/* Main card */}
      <div className="relative z-10 w-full max-w-xl">
        <div className="glass rounded-3xl p-8 sm:p-10 border border-[rgba(255,255,255,0.06)] bg-[#05080f]/60 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          
          {/* Card Header & Avatar */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-8 text-center sm:text-left">
            <GradientAvatar name={card.displayName || "Anonymous"} />
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <h1 
                  id="card-display-name" 
                  className="text-3xl font-bold tracking-tight text-[var(--fg-primary)]"
                  style={{ fontFamily: "var(--font-outfit)" }}
                >
                  {card.displayName || "Anonymous"}
                </h1>
                
                {/* Visibility badges */}
                {isPrivate && (
                  <span className="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] font-medium text-red-400">
                    Private
                  </span>
                )}
                {isFriendsOnly && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-medium text-amber-400">
                    Friends Only
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--fg-secondary)] max-w-md">
                {card.bio || "This traveler has not written a bio yet."}
              </p>
              <div className="text-xs text-[var(--fg-muted)] font-mono">
                Version {card.version} · Registered {new Date(card.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-[var(--glass-border)] to-transparent my-6" />

          {/* Card Body - Universal Nodes */}
          <div className="space-y-6">
            
            {/* Shows Section */}
            {shows.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-widest mb-3 font-mono">
                  📺 Favorite Media & Shows
                </h2>
                <div className="flex flex-wrap gap-2">
                  {shows.map((n) => (
                    <span 
                      key={n.id} 
                      className="px-3.5 py-1.5 rounded-full bg-[rgba(96,212,200,0.06)] border border-[rgba(96,212,200,0.15)] text-sm text-[#60d4c8] font-medium hover:border-[rgba(96,212,200,0.3)] transition-all duration-300 hover:shadow-[0_0_15px_rgba(96,212,200,0.05)]"
                    >
                      {n.displayName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Characters Section */}
            {characters.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-widest mb-3 font-mono">
                  🎭 Identified Characters
                </h2>
                <div className="flex flex-wrap gap-2">
                  {characters.map((n) => (
                    <span 
                      key={n.id} 
                      className="px-3.5 py-1.5 rounded-full bg-[rgba(56,189,248,0.06)] border border-[rgba(56,189,248,0.15)] text-sm text-[#38bdf8] font-medium hover:border-[rgba(56,189,248,0.3)] transition-all duration-300 hover:shadow-[0_0_15px_rgba(56,189,248,0.05)]"
                    >
                      {n.displayName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Traits Section */}
            {traits.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-widest mb-3 font-mono">
                  ✦ Personality Traits
                </h2>
                <div className="flex flex-wrap gap-2">
                  {traits.map((n) => (
                    <span 
                      key={n.id} 
                      className="px-3.5 py-1.5 rounded-full bg-[rgba(167,139,250,0.06)] border border-[rgba(167,139,250,0.15)] text-sm text-[#a78bfa] font-medium hover:border-[rgba(167,139,250,0.3)] transition-all duration-300 hover:shadow-[0_0_15px_rgba(167,139,250,0.05)]"
                    >
                      {n.displayName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {associatedNodes.length === 0 && (
              <div className="text-center py-6 text-sm text-[var(--fg-muted)] border border-dashed border-[var(--glass-border)] rounded-2xl">
                This identity card has no nodes linked to it yet.
              </div>
            )}

          </div>
        </div>

        {/* Footer CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 px-4">
          <Link 
            href="/explore" 
            className="text-sm font-medium text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] transition-colors flex items-center gap-1.5"
          >
            ← Explore the Graph
          </Link>

          {isOwner ? (
            <div className="flex items-center gap-3">
              <Link 
                href="/card/edit" 
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--glass-border)] text-[var(--fg-primary)] hover:bg-[var(--bg-hover)] transition-all duration-300"
              >
                ✏️ Edit Card
              </Link>
              <ChallengeModal associatedNodes={associatedNodes} />
            </div>
          ) : (
            <Link 
              href="/" 
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--glass-border)] text-[var(--fg-primary)] hover:bg-[var(--bg-hover)] transition-all duration-300 hover:border-[#60d4c8]/20 hover:shadow-[0_0_15px_rgba(96,212,200,0.05)]"
            >
              Create Your Identity Card
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
