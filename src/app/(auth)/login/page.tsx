"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { signIn, authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  
  // Auth tabs: "password" or "magic"
  const [authMethod, setAuthMethod] = useState<"password" | "magic">("password");
  
  // Credentials
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Loading & states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Forgot password states
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      if (authMethod === "password") {
        const result = await authClient.signIn.email({ email, password, rememberMe: true });
        if (result.error) {
          setError(result.error.message || "Login failed");
        } else {
          router.push("/card/edit");
        }
      } else {
        // Magic link / OTP entry
        const result = await authClient.signIn.magicLink({ 
          email, 
          callbackURL: "/card/edit" 
        });
        if (result.error) {
          setError(result.error.message || "Failed to send magic link");
        } else {
          setSuccessMsg("✨ A secure magic sign-in link has been sent to your email!");
        }
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGithubLogin = async () => {
    await authClient.signIn.social({ provider: "github", callbackURL: "/card/edit" });
  };

  const handleGoogleLogin = async () => {
    await authClient.signIn.social({ provider: "google", callbackURL: "/card/edit" });
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError("");
    setForgotSuccess("");
    try {
      const result = await authClient.requestPasswordReset({
        email: forgotEmail,
        redirectTo: window.location.origin + "/reset-password",
      });
      if (result.error) {
        setForgotError(result.error.message || "Failed to initiate recovery");
      } else {
        setForgotSuccess("🗝️ Password reset link sent successfully! Check your inbox.");
      }
    } catch {
      setForgotError("Something went wrong. Please try again.");
    } finally {
      setForgotLoading(false);
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
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="text-center mb-6"
        >
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#60d4c8] to-[#38bdf8] flex items-center justify-center">
              <span className="text-[#05080f] font-bold text-lg">T</span>
            </div>
          </Link>
          <h1
            className="text-2xl font-bold text-[var(--fg-primary)]"
            style={{ fontFamily: "var(--font-outfit)" }}
          >
            Welcome back
          </h1>
          <p className="text-sm text-[var(--fg-secondary)] mt-1">
            Sign in to continue exploring the graph
          </p>
        </motion.div>

        {/* Card */}
        <div className="glass rounded-2xl p-8 relative">
          
          {/* Social Logins */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {/* Google Social OAuth */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              onClick={handleGoogleLogin}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--glass-border)] text-[var(--fg-primary)] text-xs font-semibold transition-all duration-300 hover:border-[rgba(96,212,200,0.2)] hover:shadow-[0_0_15px_rgba(96,212,200,0.05)]"
            >
              {/* Google Brand SVG */}
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5.04c1.65 0 3.13.57 4.3 1.69l3.22-3.22C17.58 1.64 14.95 1 12 1 7.35 1 3.37 3.68 1.48 7.58l3.78 2.93c.89-2.67 3.39-4.47 6.74-4.47z"
                />
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.51h6.46c-.29 1.48-1.14 2.73-2.42 3.58l3.75 2.91c2.19-2.02 3.7-5.01 3.7-8.66z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.26 14.75c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28L1.48 7.26C.53 9.17 0 11.31 0 13.5s.53 4.33 1.48 6.24l3.78-2.99z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.75-2.91c-1.04.7-2.38 1.11-4.21 1.11-3.35 0-5.85-1.8-6.74-4.47L1.48 16.8C3.37 20.7 7.35 23 12 23z"
                />
              </svg>
              Google
            </motion.button>

            {/* GitHub Social OAuth */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              onClick={handleGithubLogin}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--glass-border)] text-[var(--fg-primary)] text-xs font-semibold transition-all duration-300 hover:border-[rgba(96,212,200,0.2)] hover:shadow-[0_0_15px_rgba(96,212,200,0.05)]"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              GitHub
            </motion.button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-5">
            <div className="flex-1 h-px bg-[var(--glass-border)]" />
            <span className="text-[10px] text-[var(--fg-muted)] uppercase tracking-wider font-mono">or email entry</span>
            <div className="flex-1 h-px bg-[var(--glass-border)]" />
          </div>

          {/* Auth Method Tabs */}
          <div className="grid grid-cols-2 p-1 bg-[var(--bg-elevated)] border border-[var(--glass-border)] rounded-xl mb-5 text-xs font-semibold">
            <button
              onClick={() => { setAuthMethod("password"); setError(""); setSuccessMsg(""); }}
              className={`py-1.5 rounded-lg transition-all duration-300 ${authMethod === "password" ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]" : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"}`}
            >
              🔒 Password
            </button>
            <button
              onClick={() => { setAuthMethod("magic"); setError(""); setSuccessMsg(""); }}
              className={`py-1.5 rounded-lg transition-all duration-300 ${authMethod === "magic" ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]" : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"}`}
            >
              ✨ Magic Link
            </button>
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs text-[var(--fg-secondary)] mb-1.5 font-medium">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--fg-primary)] text-sm placeholder:text-[var(--fg-muted)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-glow)] transition-all duration-300"
              />
            </div>

            {authMethod === "password" && (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor="password" className="block text-xs text-[var(--fg-secondary)] font-medium">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => { setShowForgot(true); setForgotSuccess(""); setForgotError(""); }}
                    className="text-[10px] text-[var(--brand-primary)] hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--fg-primary)] text-sm placeholder:text-[var(--fg-muted)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-glow)] transition-all duration-300"
                />
              </div>
            )}

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-[var(--hot)] bg-[rgba(249,112,102,0.1)] rounded-lg px-3 py-2 border border-red-500/10"
              >
                {error}
              </motion.p>
            )}

            {successMsg && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-[var(--brand-primary)] bg-[rgba(96,212,200,0.1)] rounded-lg px-3 py-2 border border-[var(--brand-primary)]/10"
              >
                {successMsg}
              </motion.p>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-[#60d4c8] to-[#38bdf8] text-[#05080f] font-semibold text-sm transition-all duration-300 hover:shadow-[0_0_24px_rgba(96,212,200,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-[#05080f]/30 border-t-[#05080f] rounded-full animate-spin" />
                  {authMethod === "password" ? "Signing in..." : "Sending link..."}
                </div>
              ) : (
                authMethod === "password" ? "Sign In with Password" : "Send Magic Sign-In Link"
              )}
            </motion.button>
          </form>
        </div>

        {/* Footer link */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-sm text-[var(--fg-secondary)] mt-6"
        >
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-[var(--brand-primary)] hover:underline font-medium"
          >
            Create your identity
          </Link>
        </motion.p>
      </motion.div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm glass rounded-2xl p-6 border border-[var(--glass-border)] bg-[#05080f]/90"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-md font-bold text-[var(--fg-primary)]" style={{ fontFamily: "var(--font-outfit)" }}>
                  Reset Password
                </h3>
                <button
                  onClick={() => setShowForgot(false)}
                  className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-[var(--fg-secondary)] mb-4">
                Enter your email address and we will send you a secure link to reset your password.
              </p>

              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--glass-border)] text-[var(--fg-primary)] text-sm focus:outline-none focus:border-[var(--brand-primary)] transition-all"
                  />
                </div>

                {forgotError && (
                  <p className="text-xs text-[var(--hot)] bg-[rgba(249,112,102,0.1)] rounded-lg px-3 py-2">
                    {forgotError}
                  </p>
                )}

                {forgotSuccess && (
                  <p className="text-xs text-[var(--brand-primary)] bg-[rgba(96,212,200,0.1)] rounded-lg px-3 py-2">
                    {forgotSuccess}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#38bdf8] to-[#a78bfa] text-[#05080f] font-semibold text-xs transition-all hover:shadow-[0_0_15px_rgba(56,189,248,0.25)] disabled:opacity-50"
                >
                  {forgotLoading ? "Sending request..." : "Send Recovery Email"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
