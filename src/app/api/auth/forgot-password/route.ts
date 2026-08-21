// Step 1 of password recovery: "email me a link".
//
// The response is the same whether or not the address has an account. That's the
// whole point of the endpoint's shape — a form that says "no such account" is a
// free tool for checking which of your users' addresses are registered here, and
// this app's users are students whose email addresses are guessable.
//
// Sitting under /api/auth/ is fine next to NextAuth's [...nextauth] catch-all:
// Next.js matches the static segment first.

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { createResetToken, normalizeEmail, resetEmail, resetUrl } from "@/lib/password-reset";
import { clientIp, throttle } from "@/lib/throttle";

const schema = z.object({ email: z.string().email().max(320) });

/** What the caller is told, always. */
const ACCEPTED = {
  ok: true,
  message: "If that email has an account, a reset link is on its way.",
};

/**
 * The link's host comes from configuration, never from the request.
 *
 * A Host header is attacker-controlled, and a reset link built from it is the
 * classic way to have an app email a working token to a domain the attacker
 * owns. Falling back to the request origin is a dev-only convenience.
 */
function baseUrl(request: Request) {
  const configured = process.env.NEXTAUTH_URL;
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return new URL(request.url).origin;
  return null;
}

export async function POST(request: Request) {
  let email: string;
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    email = normalizeEmail(parsed.data.email);
  } catch {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  // Two limits doing different jobs: per-address stops someone spamming one
  // person's inbox, per-IP stops a script sweeping many addresses.
  const perEmail = throttle(`forgot:email:${email}`, 3, 15 * 60 * 1000);
  const perIp = throttle(`forgot:ip:${clientIp(request)}`, 10, 15 * 60 * 1000);
  if (!perEmail.allowed || !perIp.allowed) {
    const retryAfter = Math.ceil(Math.max(perEmail.retryAfterMs, perIp.retryAfterMs) / 1000);
    return NextResponse.json(
      { error: "Too many reset requests. Try again in a little while." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const base = baseUrl(request);
  if (!base) {
    // Can't build a link that would reach anyone. Loud in the log, generic to the
    // caller — a 500 here would itself be a signal worth probing for.
    console.error("[forgot-password] NEXTAUTH_URL is unset; cannot build a reset link.");
    return NextResponse.json(ACCEPTED);
  }

  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      // Accounts created through Google have no password at all. Setting one is
      // still legitimate recovery — it's proof of the same mailbox Google
      // verified — and it leaves the Google button working as before.
      const { token } = await createResetToken(email);
      const mail = resetEmail(resetUrl(base, token));
      await sendMail({ to: email, ...mail });
    }
  } catch (e) {
    // A failure here (database down, Resend rejecting) must not change the reply:
    // "something went wrong" only for addresses that exist is the same leak.
    console.error("[forgot-password] could not issue a reset link:", e);
  }

  return NextResponse.json(ACCEPTED);
}
