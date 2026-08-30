// Transactional email via Resend's HTTP API (no SDK). Server-only. Soft-fails: consignment
// state changes must never be blocked by a mail outage — callers fire and forget.

const FROM = () => process.env.EMAIL_FROM || `TLC <onboarding@resend.dev>`;

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM(), to: [to], subject, text }),
    });
    if (!res.ok) console.warn('[email]', res.status, (await res.text()).slice(0, 200));
    return res.ok;
  } catch (e) {
    console.warn('[email]', (e as Error).message);
    return false;
  }
}
