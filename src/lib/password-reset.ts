// Password reset tokens.
//
// The token in the email is a 32-byte random string; what's stored is its
// SHA-256. A leaked database (or a stray log line) therefore doesn't hand anyone
// a working reset link — the same reason the password column holds a bcrypt hash
// rather than a password. Hashing here is plain SHA-256, not bcrypt: the secret
// has 256 bits of entropy, so there's nothing for a slow hash to protect.
//
// They live in `VerificationToken`, the table NextAuth already defines, keyed by
// `password-reset:<email>` so they can never be confused with a magic-link or
// email-verification token if one is added later.

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "./prisma";

/** An hour is long enough to find the email, short enough that a forwarded one goes stale. */
export const RESET_TTL_MS = 60 * 60 * 1000;

const PREFIX = "password-reset:";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function identifierFor(email: string) {
  return PREFIX + normalizeEmail(email);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issue a reset token for an address, replacing any outstanding one.
 *
 * Replacing matters: asking again because the first email didn't arrive must not
 * leave two live links, and it gives a user a way to invalidate a request they
 * didn't make.
 */
export async function createResetToken(email: string) {
  const identifier = identifierFor(email);
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + RESET_TTL_MS);

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: { identifier, token: hashToken(token), expires },
  });

  return { token, expires };
}

type Consumed =
  | { ok: true; email: string }
  | { ok: false; reason: "invalid" | "expired" };

/**
 * Is this token still good, without spending it?
 *
 * So the reset page can say "that link has expired" the moment it opens, rather
 * than after someone has typed a new password twice — clicking last week's email
 * is the ordinary way to arrive here with a dead token. Checking is safe to
 * expose: guessing a 256-bit token is not a thing an oracle helps with, and the
 * endpoint that calls this is rate-limited anyway.
 */
export async function peekResetToken(raw: string): Promise<Consumed> {
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token) return { ok: false, reason: "invalid" };

  const row = await prisma.verificationToken.findUnique({ where: { token: hashToken(token) } });
  if (!row || !row.identifier.startsWith(PREFIX)) return { ok: false, reason: "invalid" };
  if (row.expires.getTime() < Date.now()) return { ok: false, reason: "expired" };
  return { ok: true, email: row.identifier.slice(PREFIX.length) };
}

/**
 * Look a token up and spend it. Single use: the row is deleted whether the
 * password change that follows succeeds or not, because a token that has been
 * shown to work is one someone may have seen.
 *
 * Expired rows are deleted on sight rather than swept by a cron job — the only
 * thing that ever reads them is this function.
 */
export async function consumeResetToken(raw: string): Promise<Consumed> {
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token) return { ok: false, reason: "invalid" };

  const hashed = hashToken(token);
  const row = await prisma.verificationToken.findUnique({ where: { token: hashed } });
  if (!row || !row.identifier.startsWith(PREFIX)) return { ok: false, reason: "invalid" };

  // Belt and braces: the lookup above was already by exact hash, but comparing
  // in constant time keeps the pattern right if this ever becomes a scan.
  const a = Buffer.from(row.token);
  const b = Buffer.from(hashed);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "invalid" };

  await prisma.verificationToken.deleteMany({ where: { token: hashed } });

  if (row.expires.getTime() < Date.now()) return { ok: false, reason: "expired" };
  return { ok: true, email: row.identifier.slice(PREFIX.length) };
}

/** The link a user is emailed. */
export function resetUrl(baseUrl: string, token: string) {
  const url = new URL("/reset-password", baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export function resetEmail(url: string) {
  const subject = "Reset your Leadora password";
  const text = [
    "Someone (hopefully you) asked to reset the password on your Leadora account.",
    "",
    `Open this link to choose a new one — it works once and expires in an hour:`,
    url,
    "",
    "If it wasn't you, you can ignore this email. Your password hasn't changed.",
  ].join("\n");

  // Inline styles and a table-free layout: email clients strip <style> blocks and
  // flex support is patchy. Kept close to the app's warm palette all the same.
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#FFFAF5;font-family:ui-rounded,system-ui,-apple-system,Segoe UI,sans-serif;color:#1c1917">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid rgba(0,0,0,0.06);border-radius:24px;padding:28px">
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">Reset your password</h1>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:rgba(0,0,0,0.65)">
      Someone (hopefully you) asked to reset the password on your Leadora account.
      Choose a new one with the button below — it works once and expires in an hour.
    </p>
    <p style="margin:0 0 22px">
      <a href="${url}" style="display:inline-block;background:#7FB800;color:#000000;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">Choose a new password</a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:rgba(0,0,0,0.5)">
      If the button doesn't work, paste this into your browser:<br>
      <span style="word-break:break-all;color:rgba(0,0,0,0.65)">${url}</span>
    </p>
    <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:rgba(0,0,0,0.5)">
      If it wasn't you, you can ignore this email — your password hasn't changed.
    </p>
  </div>
</body></html>`;

  return { subject, text, html };
}
