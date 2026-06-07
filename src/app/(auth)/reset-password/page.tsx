"use client";

import { useState, Suspense } from "react";
import { motion } from "motion/react";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("Reset token is missing. Please initiate recovery again.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token: token,
      });
      if (result.error) {
        setError(result.error.message || "Failed to reset password. The link might be expired.");
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 bg-mesh pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[rgba(96,212,200,0.04)] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[rgba(56,189,248,0.03)] rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#60d4c8] to-[#38bdf8] flex items-center justify-center">
              <span className="text-[#05080f] font-bold text-lg">T</span>
            </div>
          </Link>
          <h1
            className="text-2xl font-bold text-[var(--fg-primary)]"
            style={{ fontFamily: "var(--font-outfit)" }}
          >
            Reset Password
          </h1>
          <p className="text-sm text-[var(--fg-secondary)] mt-1">
            Choose a new, secure password for your identity
          </p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-8">
          {success ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 rounded-full bg-[rgba(96,212,200,0.1)] border border-[var(--brand-primary)]/20 flex items-center justify-center mx-auto text-xl">
                ✓
              </div>
              <h3 className="font-bold text-[var(--fg-primary)]" style={{ fontFamily: "var(--font-outfit)" }}>
                Password Updated!
              </h3>
              <p className="text-xs text-[var(--fg-muted)]">
                Your password has been successfully updated. Redirecting you to login in a few seconds...
              </p>
              <Link
                href="/login"
                className="inline-block px-4 py-2 bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/30 rounded-xl text-xs font-semibold text-[var(--brand-primary)]"
              >
                Go to Login Now
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="pass" className="block text-xs text-[var(--fg-secondary)] mb-1.5 font-medium">
                  New Password
                </label>
                <input
                  id="pass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Min 8 characters"
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--fg-primary)] text-sm focus:outline-none focus:border-[var(--brand-primary)] transition-all"
                />
              </div>

              <div>
                <label htmlFor="confirm" className="block text-xs text-[var(--fg-secondary)] mb-1.5 font-medium">
                  Confirm Password
                </label>
                <input
                  id="confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Repeat your password"
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--fg-primary)] text-sm focus:outline-none focus:border-[var(--brand-primary)] transition-all"
                />
              </div>

              {error && (
                <p className="text-xs text-[var(--hot)] bg-[rgba(249,112,102,0.1)] rounded-lg px-3 py-2 border border-red-500/10">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#60d4c8] to-[#38bdf8] text-[#05080f] font-semibold text-sm transition-all hover:shadow-[0_0_20px_rgba(96,212,200,0.3)] disabled:opacity-50"
              >
                {loading ? "Updating password..." : "Confirm Password Update"}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#05080f]">
        <div className="fixed inset-0 bg-mesh pointer-events-none" />
        <div className="w-10 h-10 border-4 border-[var(--brand-primary)]/20 border-t-[var(--brand-primary)] rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
