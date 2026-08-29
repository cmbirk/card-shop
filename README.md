# GEM — a walkable 3D trading-card shop

A browser trading-card shop built like a game, not a storefront. You arrive outside at dusk,
sign the guestbook, and step into a cozy hobby shop: browse cards by sport on wooden shelves,
dig through bargain bins, admire graded slabs in the glass case, pick any card up to flip and
inspect it, drop it in a basket, and check out at the counter — where **Chris**, the AI
shopkeeper (Claude-powered), knows every card in stock, with **Maya** minding the good stuff.

Live at **[gemcardshop.com](https://gemcardshop.com)**. Built with React Three Fiber + Vite +
TypeScript, on Vercel (static client + `/api` serverless functions), backed by Supabase
(Postgres inventory + Auth + Storage).

> Building on this? Read **[`CLAUDE.md`](./CLAUDE.md)** — it's the architecture map plus the
> gotchas (Vercel serverless, Supabase RLS, GLB materials) and conventions that keep changes safe.

## Run it locally

```bash
npm install
cp .env.example .env.local     # add ANTHROPIC_API_KEY + your Supabase keys (see below)
npm run dev:client -- --port 5199   # Vite dev server; also dev-mounts /api
```

Open http://localhost:5199. The app runs even before Supabase/keys are configured — it falls
back to bundled mock inventory and an ungated experience so nothing is bricked during setup.

```bash
npm test        # vitest: placement determinism, money math, grounding coverage
npm run build   # tsc --noEmit + vite build
```

### Environment (`.env.local`, and Vercel env)

```
ANTHROPIC_API_KEY=...            # the AI shopkeeper
SHOPKEEPER_MODEL=claude-haiku-4-5
ANTHROPIC_WORKSPACE_ID=...       # only if the key is workspace/identity-linked
VITE_SUPABASE_URL=...            # browser-safe (security is via RLS, not secrecy)
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...    # SERVER-ONLY — never prefix with VITE_
```

### Supabase (inventory, auth, storage)

Managed via the Supabase CLI — schema lives in `supabase/migrations/`. Full one-time setup in
**[`supabase/SETUP.md`](./supabase/SETUP.md)**. Day to day:

```bash
npm run db:push    # apply migrations to the linked project
npm run db:seed    # migrate the bundled cards into the DB (one-time)
npm run db:types   # regenerate src/lib/database.types.ts
```

## Deploy (Vercel)

Push to GitHub → import in Vercel (Vite preset auto-detected) → set the env vars above →
deploy. The client goes to the CDN; `api/*.ts` become Node serverless functions on the same
origin. A custom domain (e.g. gemcardshop.com) bypasses Vercel's SSO wall — the app protects
itself via the guestbook + the token gate below.

## How it's put together

```
shared/            used by client AND api — types.ts, cardMapping.ts (row↔Card), data/
api/               Vercel serverless (named POST/GET exports, .js ESM imports — see CLAUDE.md)
  chat.ts          POST /api/chat → SSE from Claude; verifies the Supabase JWT first
  _lib/            shopkeeper.ts (persona + grounding), inventoryContext.ts, auth.ts (token gate)
supabase/          migrations/, seed.mjs, SETUP.md
src/
  feel.ts          every animation duration/ease — tune game feel in one file
  lib/supabase.ts  browser client (anon key); database.types.ts (generated)
  stores/          zustand: nav, basket, inspect, dialogue, ui, auth
  systems/         inventory (live Supabase read + bundled fallback), placement, rng, sfx
  scene/           Shop, Facade, StationController (glide nav), fixtures/, cards/,
                   Shopkeeper (Chris), Maya, Basket, materials/pbr
  admin/           admin CRUD + panel (add/price/photograph cards)  ⟵ in progress
  ui/              DOM overlays: chat, basket, inspect, checkout, sign-in
scripts/verify.mjs  headless screenshot/console verify (see the verify-app skill)
```

## Notable mechanics

- **Everyone signs in on entry.** A guestbook by the door (email magic link via Supabase Auth,
  session persisted in `localStorage`) gates the shop. `/api/chat` verifies the caller's token
  before any Claude call, so anonymous visitors can't spend Anthropic tokens.
- **Live inventory, admin-managed.** Cards live in Supabase; customers read a `cards_public`
  view (admin-only columns like cost basis hidden), and RLS lets only admins (rows in the
  `admins` table) write. Chris's grounding reads the DB (TTL-cached), so new cards show up
  without a redeploy.
- **Cards are data; positions are derived.** `placement.ts` maps inventory → shelf slots with
  seeded jitter. Moving a shelf never touches card data.
- **Procedural art, real scans override.** Card faces are canvas-generated (fictional
  players — licensing-safe) in texture atlases; a card's `images.front` paints its real scan
  over the atlas cell. Graded cards render as brand-accurate slabs (PSA/BGS/TAG/SGC labels).
- **Real graded cards via cert ingestion.** `scripts/addPsaCard.mjs` (PSA API) and
  `scripts/addTagCard.mjs` (TAG public DIG pages) pull real card data + high-res scans.
- **No physics engine.** Pickup/flip/basket/checkout are choreographed damped tweens (`maath`),
  deterministic and interruptible, all tuned from `feel.ts`.
- **Rigged characters.** Chris and Maya are GLB models (idle/talk/gesture clips, head-tracking);
  Chris's gestures fire on real events (wave on greet, nod at checkout, shrug on a walk-out).
- **Realistic materials.** CC0 PBR texture sets + an HDRI environment + subtle post-processing.

## Roadmap

Finishing the **admin panel + in-world back office** (add/price/photograph cards from a desk
computer). Then: Stripe checkout, first-person WASD (the nav rig is already a swappable
component), pack-ripping, and richer Chris. See the plan doc for detail.

Football card scans in `public/cards/football/` are 1894 Mayo Cut Plug cards via Wikimedia
Commons / The MET Open Access (public domain).
