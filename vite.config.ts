import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';

const root = fileURLToPath(new URL('.', import.meta.url));

// Dev-only mount of the SAME web-standard handler that Vercel deploys from /api —
// one handler, two mounts, zero drift. `npm run dev` (vercel dev) is the
// high-fidelity path; this keeps plain `vite` fully functional too.
function apiDev(): Plugin {
  return {
    name: 'api-dev',
    configureServer(server) {
      server.middlewares.use('/api/chat', (req, res) => void handle(server, '/api/chat.ts', req, res));
      server.middlewares.use('/api/health', (req, res) => void handle(server, '/api/health.ts', req, res));
      server.middlewares.use('/api/checkout', (req, res) => void handle(server, '/api/checkout.ts', req, res));
      server.middlewares.use('/api/stripe-webhook', (req, res) => void handle(server, '/api/stripe-webhook.ts', req, res));
      server.middlewares.use('/api/orders', (req, res) => void handle(server, '/api/orders.ts', req, res));
      server.middlewares.use('/api/consign-notify', (req, res) => void handle(server, '/api/consign-notify.ts', req, res));
    },
  };
}

async function handle(server: ViteDevServer, file: string, req: IncomingMessage, res: ServerResponse) {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const mod = await server.ssrLoadModule(`/${file.replace(/^\//, '')}`);
    // dispatch by HTTP-method export, matching Vercel's web-handler convention
    const fn = mod[(req.method ?? 'GET').toUpperCase()] as ((r: Request) => Promise<Response> | Response) | undefined;
    if (!fn) {
      res.statusCode = 405;
      res.end('Method not allowed');
      return;
    }
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') headers.set(k, v);
    }
    const webReq = new Request(`http://localhost${req.url ?? '/'}`, {
      method: req.method,
      headers,
      body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
    });
    const webRes: Response = await fn(webReq);
    res.statusCode = webRes.status;
    webRes.headers.forEach((v, k) => res.setHeader(k, v));
    if (webRes.body) {
      const reader = webRes.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err) {
    console.error('[api-dev]', err);
    res.statusCode = 500;
    res.end('Internal error');
  }
}

export default defineConfig(({ mode }) => {
  // surface .env.local vars to the dev-mounted api handlers (they read process.env)
  const env = loadEnv(mode, root, '');
  for (const k of [
    'ANTHROPIC_API_KEY',
    'SHOPKEEPER_MODEL',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'PUBLIC_ORIGIN',
    'RESEND_API_KEY',
    'EMAIL_FROM',
  ]) {
    if (env[k]) process.env[k] ??= env[k]; // never assign undefined — process.env would store "undefined"
  }

  return {
    plugins: [react(), apiDev()],
    resolve: {
      alias: { '@shared': `${root}shared` },
    },
  };
});
