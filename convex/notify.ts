const normalizeEmails = (raw?: string) =>
  (raw || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

const defaultNotifyEmail = "prrhran@gmail.com";

export async function sendAdminNotification(subject: string, html: string) {
  const to = normalizeEmails(process.env.ADMIN_NOTIFY_EMAIL || defaultNotifyEmail);
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL;
  const fromName = process.env.FROM_NAME || "PrHran";

  if (to.length === 0) {
    console.warn("ADMIN_NOTIFY_EMAIL ni nastavljen. Preskakujem obvestilo.");
    return false;
  }
  if (!apiKey) {
    console.warn("RESEND_API_KEY ni nastavljen. Preskakujem obvestilo.");
    return false;
  }
  if (!fromEmail) {
    console.warn("FROM_EMAIL ni nastavljen. Preskakujem obvestilo.");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const msg = await res.text();
      console.warn("Resend API error:", msg);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("Admin notify email failed:", error);
    return false;
  }
}
