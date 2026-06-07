import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { magicLink } from "better-auth/plugins";
import * as schema from "./schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: false, // set to false for quick MVP login, but sends email if Resend is configured
    sendVerificationEmail: async ({ user, url }: { user: any; url: string }) => {
      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) {
        console.log(`[AUTH] Verification link for ${user.email}: ${url}`);
        return;
      }
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || "ThreadSpace <onboarding@resend.dev>",
            to: user.email,
            subject: "Verify your ThreadSpace Identity",
            html: `
              <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background-color: #05080f; color: #e8ecf4; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06);">
                <h2 style="color: #60d4c8;">Verify your identity</h2>
                <p>Hello ${user.name || "Traveler"},</p>
                <p>Welcome to ThreadSpace! Please verify your email to activate your node in the discovery graph.</p>
                <a href="${url}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(90deg, #60d4c8, #38bdf8); color: #05080f; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">Verify Email</a>
                <p style="font-size: 11px; color: #a7b3c6;">If the button doesn't work, copy and paste this link in your browser: <br/> ${url}</p>
              </div>
            `,
          }),
        });
      } catch (err) {
        console.error("Failed to send verification email:", err);
      }
    },
    sendResetPassword: async ({ user, url }: { user: any; url: string }) => {
      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) {
        console.log(`[AUTH] Password reset link for ${user.email}: ${url}`);
        return;
      }
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || "ThreadSpace <onboarding@resend.dev>",
            to: user.email,
            subject: "Reset your ThreadSpace Password",
            html: `
              <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background-color: #05080f; color: #e8ecf4; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06);">
                <h2 style="color: #38bdf8;">Reset your password</h2>
                <p>Hello ${user.name || "Traveler"},</p>
                <p>We received a request to reset your password. If this was you, please click the button below to set a new password:</p>
                <a href="${url}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(90deg, #38bdf8, #a78bfa); color: #05080f; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">Reset Password</a>
                <p style="font-size: 11px; color: #a7b3c6;">This link is valid for 1 hour. If you didn't request a reset, you can safely ignore this email.</p>
              </div>
            `,
          }),
        });
      } catch (err) {
        console.error("Failed to send reset password email:", err);
      }
    },
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24,       // refresh every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }: { email: string; url: string }) => {
        const resendApiKey = process.env.RESEND_API_KEY;
        if (!resendApiKey) {
          console.log(`[AUTH] Magic Link for ${email}: ${url}`);
          return;
        }
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: process.env.EMAIL_FROM || "ThreadSpace <onboarding@resend.dev>",
              to: email,
              subject: "Sign in to ThreadSpace",
              html: `
                <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background-color: #05080f; color: #e8ecf4; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06);">
                  <h2 style="color: #60d4c8;">Sign in passwordlessly</h2>
                  <p>Welcome back! Click the button below to sign in to your ThreadSpace account directly:</p>
                  <a href="${url}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(90deg, #60d4c8, #38bdf8); color: #05080f; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">Sign In</a>
                  <p style="font-size: 11px; color: #a7b3c6;">This link is one-time use and valid for 10 minutes. If you did not request this, you can ignore this email.</p>
                </div>
              `,
            }),
          });
        } catch (err) {
          console.error("Failed to send magic link:", err);
        }
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
