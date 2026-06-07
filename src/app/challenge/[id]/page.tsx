import { getChallengeDetails } from "@/app/actions/challenge";
import { ChallengeClient } from "./challenge-client";
import { notFound } from "next/navigation";
import { Metadata } from "next";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const challenge = await getChallengeDetails(id);
    return {
      title: `Identity Challenge: Find ${challenge.creatorName} | ThreadSpace`,
      description: `Follow the clues to traverse the graph and unlock ${challenge.creatorName}'s profile on ThreadSpace.`,
    };
  } catch {
    return {
      title: "Challenge Link | ThreadSpace",
    };
  }
}

export default async function ChallengePage({ params }: PageProps) {
  const { id } = await params;

  let challenge;
  try {
    challenge = await getChallengeDetails(id);
  } catch (err) {
    notFound();
  }

  if (challenge.isExpired) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden bg-[#05080f]">
        <div className="fixed inset-0 bg-mesh pointer-events-none opacity-40" />
        <div className="relative z-10 w-full max-w-md">
          <div className="glass rounded-3xl p-8 border border-[rgba(255,255,255,0.06)] bg-[#05080f]/60 backdrop-blur-xl shadow-2xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6 text-2xl">
              ⏳
            </div>
            <h1 className="text-xl font-bold text-[var(--fg-primary)] mb-2 font-outfit">
              Challenge Expired
            </h1>
            <p className="text-sm text-[var(--fg-muted)] mb-6">
              This challenge link was generated more than 72 hours ago and is now expired. Please ask the owner for a new link.
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

  return <ChallengeClient challenge={challenge} />;
}

// Inline Link fallback import just in case
import Link from "next/link";
