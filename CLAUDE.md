# TLC (Toploader Cards) — a walkable 3D trading-card shop

A browser card shop built like a game, not a storefront. You arrive outside, sign the
guestbook, step in, browse cards by sport as real 3D objects (pick up, flip, inspect),
chat with Chris the AI shopkeeper, carry a basket, and check out. Production: **toploadercards.com** (gemcardshop.com 308-redirects to it). The shop name on signs/receipts/persona is `SHOP_NAME` in `shared/launch.ts` — never hard-code it.

**Stack:** React Three Fiber + Vite + TypeScript · Vercel (static client + `/api` serverless
functions) · Supabase (Postgres inventory + Auth + Storage) · Claude (Haiku 4.5) shopkeeper.

## Architecture map

```
shared/            used by BOTH client and api — types.ts, cardMapping.ts (row↔Card), data/
api/               Vercel serverless (see the Vercel gotcha below)
  chat.ts          POST /api/chat → SSE stream from Claude; verifies the Supabase JWT first
  checkout.ts / stripe-webhook.ts / orders.ts — Stripe Checkout (see gotcha below)
  _lib/            shopkeeper.ts (persona + grounding), inventoryContext.ts, auth.ts (token gate)
supabase/          schema in migrations/ (apply with npm run db:push); seed.mjs; SETUP.md
src/
  feel.ts          EVERY animation duration/ease constant — tune game feel in one file
  lib/supabase.ts  browser client (anon key); database.types.ts (generated)
  stores/          zustand: nav, basket, inspect, dialogue, ui, auth
  systems/         inventory (live Supabase read + bundled fallback), placement, rng, sfx
  scene/           Shop, Facade, StationController (glide nav), fixtures/, cards/, Shopkeeper (Chris),
                   Maya, Basket, BackOfficeDoor (STAFF ONLY → admin panel), ShowcaseRoom + ShowcaseDoor
                   ("The Collection" annex off the west wall; ANNEX/ANNEX_DOOR in shopLayout;
                   display name = ROOM_NAME in shared/data/showcase.ts), materials/pbr
  admin/           adminCards.ts (CRUD, bulk delete/upsert, CSV/JSON import+export — unit-tested),
                   adminUsers.ts (profiles ⨝ admins, setAdmin)
  ui/              DOM overlays: chat, hold-pile chip (BasketPanel), inspect, checkout, sign-in,
                   admin/ (AdminPanel shell + InventoryTab/ImportTab/UsersTab/CardForm)
```

## Critical gotchas (these have bitten us)

- **Vercel serverless needs named HTTP-method exports + explicit ESM.** `api/**/*.ts` must
  `export function POST(req: Request)` / `GET()` — a `export default handler` gets the legacy
  `(req,res)` signature and `req.headers.get` throws. Relative imports need **`.js` extensions**;
  JSON imports need **`with { type: 'json' }`**. The Vite dev mount masks all of this, so it only
  breaks *deployed* — **verify prod functions, not just dev** (`/deploy-check`, curl toploadercards.com).
- **Supabase security is RLS, not key secrecy.** The anon key is public by design; customers read
  the `cards_public` view (admin columns hidden); admin writes go browser→Supabase under the JWT,
  gated by `is_admin()`. Service role key is **server-only** (grounding fn). `/api/chat` verifies
  the caller's token so anonymous users can't spend Anthropic tokens.
- **Meshy GLB characters** (Chris, Maya) export `alphaMode=BLEND` + `doubleSided` → tearing/bleed.
  Sanitize on load: opaque + alphaTest, `FrontSide`, mipmaps off, roughness≥0.65 (see `Shopkeeper.tsx`).
- **Stripe: the webhook is the only writer of `sold`.** `/api/checkout` snapshots prices from the DB
  (never the client), reserves via the `reserve_cards` SQL function (atomic, lapsed reservations
  count as available), and `/api/stripe-webhook` verifies the signature over `req.text()` — never
  `req.json()` first. New env vars must be added to the surfaced list in `vite.config.ts` AND
  guarded (`if (env[k])`) — assigning `undefined` to `process.env` stores the string "undefined".
- **Ximilar (/api/identify):** thresholds are empirical (match ≤0.45, ambiguous ≤0.65; blurry →
  best_match null; garbage → their HTTP 500) — recalibrate before changing. Photo gates run
  client-side first; identified summaries ride `context.identified` on the user turn.
- **Prompt-cache stability:** the shopkeeper system prompt must be byte-stable across a conversation,
  so the Supabase grounding read is `ORDER BY id` and volatile basket context rides the user turn.

## Conventions

- **Cards are data; positions are derived.** `placement.ts` maps inventory → shelf slots; never
  store 3D positions on a card. `shared/data/shopLayout.ts` is the scene source of truth.
- **`status: 'personal'` = not for sale.** Only a fixture with `accepts.status` takes them
  (`case-collection`); `InspectHud`/`inspectStore` hide price + basket; grounding lists them without a
  price. Memorabilia is data too (`shared/data/showcase.ts`) so Chris can talk about it.
- **Three rooms (main / annex / office): glides route through the room's doorway**
  (`StationController.roomOf` + `waypoints`); Chris's walk path goes through the annex door
  (`pathToSpot`). `navStore.goTo('office')` is refused for non-admins (the door gate).
- **No 3D basket.** Picks fly to the `HoldPile` on the counter (registered as `hold-pile` in
  `cardRegistry`); `basketStore` still holds the ids. Don't register pile cards per-id — that
  clobbers the shelf card's registry entry and breaks its next pickup/return.
- **Scans go through `prepareScan()`** (`src/admin/imagePrep.ts`): HEIC → JPEG (native decode, else
  `heic2any` WASM lazy-loaded — it's a 1.3 MB chunk, keep it dynamic) and ≤1600px re-encode before
  Storage. Drop zones accept Photos.app drags (`fileFromDataTransfer` checks `items` too).
- **Consignment writes are fenced by `cards_consignor_guard`** (trigger) + seller RLS: sellers
  only touch their own rows and never price/status/lore; the webhook is the only payout writer.
  Consignor names ride grounding deterministically (never break byte-stability). Seller UI =
  `ConsignPanel` (overlay), Chris's side = the admin Consign tab.
- **`profiles` is trigger-maintained** (auth.users insert / last_sign_in_at update); the client never
  writes it. Admin membership = `admins` rows; `setAdmin` refuses self-demotion.
- **Card art is procedural, real scans override.** `card.images.front` paints over the atlas cell;
  everything works without real images.
- **All animation constants live in `feel.ts`.** No magic durations/eases in components.
- **Per-frame code mutates refs, never React state.** Read zustand via `getState()` in `useFrame`.
- **Chris's whereabouts live in `shopkeeperStore`** (pose + spot); `Shopkeeper.tsx` does the walking,
  `StationController` turns the camera on `visiting`. Situational chat context (held card, station)
  goes in `ChatRequest.context` → appended to the *user* turn, never the system prompt.
- **Transparent/decorative meshes set `raycast={() => null}`** or they steal clicks (this broke
  every graded card once). Corollary: an invisible *hit box* in front of cards is also a click thief —
  its hit bubbles to `FixtureGroup`'s `stopPropagation` and drops every hit behind it. `Bin.tsx`
  raycasts its wheel target manually instead of giving it R3F handlers.
- **The wheel is shared:** `CardInHand` owns it while inspecting; `Bin` only riffles when parked at
  `bins` with nothing in hand. `binSlot` is the closed-stack rest pose; `Bin.tsx` animates offsets.

## Dev workflow

- `npm run dev` — Vite + dev-mounted `/api`. `.env.local` (gitignored) holds
  Anthropic + Supabase keys. `npm run build` = tsc + vite build. `npm test` = vitest.
- **Verify visually with the `verify-app` skill** (headless Playwright screenshot + console capture).
  Dev hooks in dev mode: `window.__nav / __inspect / __basket / __ui / __auth / __dialogue / __keeper / __maya`.
  Camera glide is slow headless — poll `__nav.getState()` for arrival before asserting. `verify.mjs`
  actions `admin` / `adminFlag` fake admin status; `ask,<id>` runs the hold-up-a-card → Chris walks
  over flow (headless has no JWT, so the fallback line shows — the walk still exercises fully);
  `tilt,<yaw>,<pitch>` poses the held card (sheen shots); `riffle,<binId>,<n>` / `wheel,<dy>` dig a bin.
- **Admin edits must call `reloadInventory()`** (bumps `useInventoryVersion`) or the shelves
  won't re-place until a page reload.
- **Supabase:** `npm run db:push` (apply migrations), `db:seed`, `db:types`. Project ref in
  `supabase/.temp` (gitignored). See `supabase/SETUP.md`.

## NEVER `git add -A` / `git add .`

It has twice swept junk into commits here (87MB of raw Meshy exports; a parallel session's WIP).
**Stage explicit paths.** A hook blocks the bulk form. Commit/push only when asked; end commit
messages with the Co-Authored-By / Claude-Session trailers.
