// Transactional email, over Resend's HTTP API rather than an SDK: the only thing
// the app ever sends is a short link, and `fetch` does that without another
// dependency in the bundle (or another package to keep patched).
//
// Sending is *optional infrastructure*. If `RESEND_API_KEY` isn't set the app
// still works — `sendMail` reports `skipped` and the caller decides what that
// means. Nothing user-facing may branch on the result, though: telling a visitor
// "we couldn't email you" on the forgot-password screen would confirm which
// addresses have accounts (see `/api/auth/forgot-password`).

type Mail = { to: string; subject: string; text: string; html: string };

export type MailResult =
  | { ok: true }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped: false; reason: string };

/** Who mail comes from. Must be an address on a domain verified with Resend. */
function from() {
  return process.env.EMAIL_FROM || "Leadora <onboarding@resend.dev>";
}

export function mailerConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendMail(mail: Mail): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Dev convenience: without a key there's no way to see the link at all, and
    // a developer testing the flow needs one. Never logged in production.
    if (process.env.NODE_ENV !== "production") {
      console.log(`[mailer] RESEND_API_KEY unset — would have emailed ${mail.to}:\n${mail.text}`);
    }
    return { ok: false, skipped: true, reason: "RESEND_API_KEY is not set" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: from(),
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      // The address is deliberately absent from the log line: these logs are for
      // debugging delivery, not a record of who asked to reset a password.
      console.error(`[mailer] Resend rejected the send (${res.status}): ${detail.slice(0, 500)}`);
      return { ok: false, skipped: false, reason: `Resend returned ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[mailer] send failed:", e);
    return { ok: false, skipped: false, reason: "network error" };
  }
}
