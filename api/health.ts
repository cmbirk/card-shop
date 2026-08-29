// Named method export — see api/chat.ts for why (Vercel web-handler signature).
export function GET(): Response {
  return Response.json({ ok: true, hasKey: Boolean(process.env.ANTHROPIC_API_KEY) });
}
