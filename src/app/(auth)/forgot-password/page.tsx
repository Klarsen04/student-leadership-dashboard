"use client";

// "I've forgotten my password" — ask for a link.
//
// On success the screen shows the same confirmation for every address, matching
// the API: the page can't reveal what the endpoint deliberately doesn't.

import Link from "next/link";
import { useState } from "react";
import { AuthButton, AuthError, AuthShell, FIELD, MARKER } from "@/components/auth/AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Try again in a moment.");
        return;
      }
      setSent(true);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle="A reset link is on its way">
        <div className="space-y-4">
          <p className="text-sm text-black/60 leading-relaxed text-center">
            If <span className="font-semibold text-black/75">{email}</span> has an account, we&apos;ve
            sent a link for choosing a new password. It works once and expires in an hour.
          </p>
          <p className="text-xs text-black/45 leading-relaxed text-center">
            Nothing after a few minutes? Check the spam folder, or try again with a different
            address.
          </p>
          <div className="flex flex-col gap-2 pt-1">
            <Link
              href="/login"
              className="w-full min-h-[44px] flex items-center justify-center rounded-full bg-[#FFFAF5] border border-black/10 font-semibold text-sm text-black/70 hover:bg-black/[0.03] transition-colors"
              style={MARKER}
            >
              Back to sign in
            </Link>
            <button
              onClick={() => setSent(false)}
              className="text-sm font-semibold text-black/50 hover:text-black transition-colors"
              style={MARKER}
            >
              Use a different email
            </button>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot your password?" subtitle="We'll email you a link to reset it">
      <form onSubmit={handleSubmit} className="space-y-4 mb-5">
        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-black/60 mb-1.5">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={FIELD}
            placeholder="you@example.com"
          />
        </div>

        {error && <AuthError>{error}</AuthError>}

        <AuthButton type="submit" loading={loading}>
          Send reset link
        </AuthButton>
      </form>

      <div className="text-center">
        <Link
          href="/login"
          className="text-sm font-semibold text-black/60 hover:text-black transition-colors"
          style={MARKER}
        >
          Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
