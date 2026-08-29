# GEM — a walkable 3D trading-card shop

A browser card shop built like a game, not a storefront. You arrive outside, sign the
guestbook, step in, browse cards by sport as real 3D objects (pick up, flip, inspect),
chat with Chris the AI shopkeeper, carry a basket, and check out. Production: **gemcardshop.com**.

**Stack:** React Three Fiber + Vite + TypeScript · Vercel (static client + `/api` serverless
functions) · Supabase (Postgres inventory + Auth + Storage) · Claude (Haiku 4.5) shopkeeper.

## Architecture map

```
shared/            used by BOTH client and api — types.ts, cardMapping.ts (row↔Card), data/
api/               Vercel serverless (see the Vercel gotcha below)
  chat.ts          POST /api/chat → SSE stream from Claude; verifies the Supabase JWT first
  _lib/            shopkeeper.ts (persona + grounding), inventoryContext.ts, auth.ts (token gate)
supabase/          schema in migrations/ (apply with npm run db:push); seed.mjs; SETUP.md
src/
  feel.ts          EVERY animation duration/ease constant — tune game feel in one file
  lib/supabase.ts  browser client (anon key); database.types.ts (generated)
  stores/          zustand: nav, basket, inspect, dialogue, ui, auth
  systems/         inventory (live Supabase read + bundled fallback), placement, rng, sfx
  scene/           Shop, Facade, StationController (glide nav), fixtures/, cards/, Shopkeeper (Chris),
                   Maya, Basket, materials/pbr
  admin/           admin CRUD + panel (add/price/photograph cards)
  ui/              DOM overlays: chat, basket, inspect, checkout, sign-in
```

## Critical gotchas (these have bitten us)

- **Vercel serverless needs named HTTP-method exports + explicit ESM.** `api/**/*.ts` must
  `export function POST(req: Request)` / `GET()` — a `export default handler` gets the legacy
  `(req,res)` signature and `req.headers.get` throws. Relative imports need **`.js` extensions**;
  JSON imports need **`with { type: 'json' }`**. The Vite dev mount masks all of this, so it only
  breaks *deployed* — **verify prod functions, not just dev** (`/deploy-check`, curl the domain).
- **Supabase security is RLS, not key secrecy.** The anon key is public by design; customers read
  the `cards_public` view (admin columns hidden); admin writes go browser→Supabase under the JWT,
  gated by `is_admin()`. Service role key is **server-only** (grounding fn). `/api/chat` verifies
  the caller's token so anonymous users can't spend Anthropic tokens.
- **Meshy GLB characters** (Chris, Maya) export `alphaMode=BLEND` + `doubleSided` → tearing/bleed.
  Sanitize on load: opaque + alphaTest, `FrontSide`, mipmaps off, roughness≥0.65 (see `Shopkeeper.tsx`).
- **Prompt-cache stability:** the shopkeeper system prompt must be byte-stable across a conversation,
  so the Supabase grounding read is `ORDER BY id` and volatile basket context rides the user turn.

## Conventions

- **Cards are data; positions are derived.** `placement.ts` maps inventory → shelf slots; never
  store 3D positions on a card. `shared/data/shopLayout.ts` is the scene source of truth.
- **Card art is procedural, real scans override.** `card.images.front` paints over the atlas cell;
  everything works without real images.
- **All animation constants live in `feel.ts`.** No magic durations/eases in components.
- **Per-frame code mutates refs, never React state.** Read zustand via `getState()` in `useFrame`.
- **Transparent/decorative meshes set `raycast={() => null}`** or they steal clicks (this broke
  every graded card once).

## Dev workflow

- `npm run dev:client -- --port 5199` — Vite + dev-mounted `/api`. `.env.local` (gitignored) holds
  Anthropic + Supabase keys. `npm run build` = tsc + vite build. `npm test` = vitest.
- **Verify visually with the `verify-app` skill** (headless Playwright screenshot + console capture).
  Dev hooks in dev mode: `window.__nav / __inspect / __basket`. Camera glide is slow headless —
  poll `__nav.getState()` for arrival before asserting.
- **Supabase:** `npm run db:push` (apply migrations), `db:seed`, `db:types`. Project ref in
  `supabase/.temp` (gitignored). See `supabase/SETUP.md`.

## NEVER `git add -A` / `git add .`

It has twice swept junk into commits here (87MB of raw Meshy exports; a parallel session's WIP).
**Stage explicit paths.** A hook blocks the bulk form. Commit/push only when asked; end commit
messages with the Co-Authored-By / Claude-Session trailers.
