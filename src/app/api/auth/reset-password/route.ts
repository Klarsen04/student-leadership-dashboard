// Step 2 of password recovery: spend the token, set the password.
//
// Unlike step 1 this one *does* say what went wrong. There's no enumeration risk
// left — the caller already holds a 256-bit secret — and "that link has expired"
// is the difference between a user asking for a fresh email and giving up.

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { consumeResetToken, peekResetToken } from "@/lib/password-reset";
import { clientIp, throttle } from "@/lib/throttle";

const schema = z.object({
  token: z.string().min(1).max(200),
  // Same floor as /api/register, so a reset can't be a way around the policy.
  password: z.string().min(8).max(200),
});

/**
 * Is the link in the address bar still good? Doesn't spend it.
 *
 * The page asks on load so a stale link says so straight away instead of after a
 * password has been typed twice. Reports nothing but valid/expired/invalid.
 */
export async function GET(request: Request) {
  const perIp = throttle(`reset-peek:ip:${clientIp(request)}`, 60, 15 * 60 * 1000);
  if (!perIp.allowed) {
    return NextResponse.json({ valid: false, reason: "throttled" }, { status: 429 });
  }

  const token = new URL(request.url).searchParams.get("token") || "";
  try {
    const peek = await peekResetToken(token);
    return NextResponse.json(peek.ok ? { valid: true } : { valid: false, reason: peek.reason });
  } catch (e) {
    console.error("[reset-password] token check failed:", e);
    // Don't send someone away from a link that might be fine — let them try.
    return NextResponse.json({ valid: true, unchecked: true });
  }
}

export async function POST(request: Request) {
  // Guessing tokens is hopeless, but there's no reason to let anyone try quickly.
  const perIp = throttle(`reset:ip:${clientIp(request)}`, 20, 15 * 60 * 1000);
  if (!perIp.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a little while." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(perIp.retryAfterMs / 1000)) } },
    );
  }

  let body: z.infer<typeof schema>;
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 400 });
  }

  try {
    const consumed = await consumeResetToken(body.token);
    if (!consumed.ok) {
      return NextResponse.json(
        {
          error:
            consumed.reason === "expired"
              ? "That reset link has expired. Ask for a new one."
              : "That reset link isn't valid any more. Ask for a new one.",
          reason: consumed.reason,
        },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: consumed.email },
      select: { id: true, email: true },
    });
    if (!user) {
      // The account was deleted between asking and confirming.
      return NextResponse.json(
        { error: "That account no longer exists.", reason: "invalid" },
        { status: 400 },
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(body.password, 12) },
    });

    // Sessions are JWTs (see `src/lib/auth.ts`), so there are no server-side
    // sessions to revoke here: an already-signed-in device stays signed in until
    // its token expires. Rows in `Session` are cleared anyway in case the
    // strategy ever changes to "database".
    await prisma.session.deleteMany({ where: { userId: user.id } }).catch(() => {});

    // The email goes back so the page can sign the user straight in rather than
    // making them retype what they just chose. It tells the caller nothing it
    // couldn't already have done with the token it just spent.
    return NextResponse.json({ ok: true, email: user.email });
  } catch (e) {
    console.error("[reset-password] failed:", e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
