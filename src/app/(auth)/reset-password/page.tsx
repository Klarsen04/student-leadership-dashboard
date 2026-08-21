"use client";

// "Choose a new password" — the other end of the emailed link.
//
// The token is only ever read from the query string and posted back; it's never
// put in the page's own history or in a link the browser might send elsewhere as
// a referrer (the app's Referrer-Policy is strict-origin-when-cross-origin).

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { AuthButton, AuthError, AuthShell, FIELD, MARKER } from "@/components/auth/AuthShell";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [dead, setDead] = useState<false | "expired" | "invalid">(false); // offer a fresh link
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check the link before showing the form. Clicking an old email is the normal
  // way to get here with a spent token, and finding that out after typing a
  // password twice is the kind of thing that makes someone give up. The check
  // doesn't consume the token; a network failure leaves the form up.
  useEffect(() => {
    if (!token) return;
    let alive = true;
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && d?.valid === false && (d.reason === "expired" || d.reason === "invalid")) {
          setDead(d.reason);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Checked here as well as server-side so a typo costs nothing but a keystroke
    // — the token is single-use, and spending it on a mismatch would be cruel.
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Try again in a moment.");
        if (data.reason === "expired" || data.reason === "invalid") setDead(data.reason);
        return;
      }

      // Straight in, since choosing the password just proved who they are. If
      // sign-in doesn't take, the password change still happened — say so and
      // send them to the normal form rather than implying it failed.
      if (data.email) {
        const result = await signIn("credentials", {
          email: data.email,
          password,
          redirect: false,
        });
        if (!result?.error) {
          window.location.href = "/dashboard";
          return;
        }
      }
      setDone(true);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token || dead) {
    return (
      <AuthShell
        title={dead === "expired" ? "That link has expired" : "That link isn't valid"}
        subtitle="Reset links work once, and only for an hour"
      >
        <div className="space-y-4">
          {error && <AuthError>{error}</AuthError>}
          <p className="text-sm text-black/60 leading-relaxed text-center">
            Ask for a new one and we&apos;ll email it straight away.
          </p>
          <Link
            href="/forgot-password"
            className="w-full min-h-[44px] flex items-center justify-center rounded-full text-black font-semibold shadow-md hover:brightness-105 transition-all"
            style={{ background: "#7FB800", ...MARKER }}
          >
            Send a new link
          </Link>
          <div className="text-center">
            <Link
              href="/login"
              className="text-sm font-semibold text-black/60 hover:text-black transition-colors"
              style={MARKER}
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="You can sign in with it now">
        <Link
          href="/login"
          className="w-full min-h-[44px] flex items-center justify-center rounded-full text-black font-semibold shadow-md hover:brightness-105 transition-all"
          style={{ background: "#7FB800", ...MARKER }}
        >
          Sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Make it one you'll remember">
      <form onSubmit={handleSubmit} className="space-y-4 mb-5">
        <div>
          <label htmlFor="password" className="block text-sm font-semibold text-black/60 mb-1.5">
            New password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className={`${FIELD} pr-11`}
              placeholder="At least 8 characters"
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full text-black/40 hover:text-black hover:bg-black/[0.04] transition-colors"
            >
              {show ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirm" className="block text-sm font-semibold text-black/60 mb-1.5">
            Confirm password
          </label>
          <input
            id="confirm"
            name="confirm"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            className={FIELD}
            placeholder="Type it again"
          />
        </div>

        {error && <AuthError>{error}</AuthError>}

        <AuthButton type="submit" loading={loading}>
          Save new password
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
