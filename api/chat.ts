import type { ChatRequest } from '../shared/types';
import { runShopkeeper } from './_lib/shopkeeper';
import { requireUser } from './_lib/auth';

export const maxDuration = 60;

function sse(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// Web-standard handler — runs identically on Vercel's Node runtime and the Vite dev mount.
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  // gate LLM spend: only signed-in visitors may talk to Chris
  const auth = await requireUser(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: 'sign in to chat' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response('Bad request', { status: 400 });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      await runShopkeeper(
        body.messages.slice(-40),
        Array.isArray(body.basket) ? body.basket.slice(0, 100) : [],
        {
          onDelta: (text) => controller.enqueue(sse('delta', { text })),
          onDone: (usage) => {
            controller.enqueue(sse('done', { usage }));
            controller.close();
          },
          onError: (message) => {
            controller.enqueue(sse('error', { message }));
            controller.close();
          },
        },
        req.signal,
      );
    },
    cancel() {
      // client went away; runShopkeeper aborts via req.signal
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
