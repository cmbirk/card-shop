# TLC (Toploader Cards) — a walkable 3D trading-card shop

A browser trading-card shop built like a game, not a storefront. You arrive outside at dusk,
sign the guestbook, and step into a cozy hobby shop: browse cards by sport on wooden shelves,
dig through bargain bins, admire graded slabs in the glass case, pick any card up to flip and
inspect it, drop it in a basket, and check out at the counter — where **Chris**, the AI
shopkeeper (Claude-powered), knows every card in stock, with **Maya** minding the good stuff.

Live at **[toploadercards.com](https://toploadercards.com)**. Built with React Three Fiber + Vite +
TypeScript, on Vercel (static client + `/api` serverless functions), backed by Supabase
(Postgres inventory + Auth + Storage).

> Building on this? Read **[`CLAUDE.md`](./CLAUDE.md)** — it's the architecture map plus the
> gotchas (Vercel serverless, Supabase RLS, GLB materials) and conventions that keep changes safe.

## Run it locally

```bash
npm install
cp .env.example .env.local     # add ANTHROPIC_API_KEY + your Supabase keys (see below)
npm run dev   # Vite dev server; also dev-mounts /api
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
origin. A custom domain (e.g. toploadercards.com) bypasses Vercel's SSO wall — the app protects
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
                   Shopkeeper (Chris), Maya, Basket, BackOfficeDoor, materials/pbr
  admin/           adminCards.ts (CRUD, bulk, CSV/JSON import+export), adminUsers.ts (visitors, admin toggle)
  ui/              DOM overlays: chat, hold-pile chip, inspect, checkout, sign-in, admin/ (Inventory·Import·Users)
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
- **Back office.** Admins walk through the "STAFF ONLY" door beside the counter into a real
  office; the desk computer (or the 🗝 HUD button) opens the panel. **Inventory:** search every
  card incl. sold/reserved/personal and cost basis, add/edit (identity, parallel/hits, grading,
  price, admin-only acquisition fields, lore), scan upload — drag photos straight from Photos.app
  (HEIC is converted to JPEG in the browser and downsized to 1600px), multi-select bulk delete, CSV export.
  **Import:** paste/upload CSV or JSON, preview new/update/error rows, import in one go (template
  provided). **Users:** everyone who's signed the guestbook (`profiles`, maintained by DB
  triggers) with an Admin toggle. Saves re-place the shelves live. Non-admins who click the door
  get waved off by Chris.
- **Checkout is real Stripe (test mode during the soft opening).** "Try the register" reserves the
  cards atomically, opens hosted Stripe Checkout priced from the database, and the webhook is the
  only thing that marks cards sold; orders are snapshotted in an `orders` table for the receipt
  (stamped TEST while `test_mode`). Cancelling or letting the session expire puts the cards back.
- **Consignment (Stage 1, invite-only).** Flip a visitor's Seller toggle in Users and they get a
  "My consignments" panel: submit cards with scans + an asking price; Chris reviews in the Consign
  tab (approve = set the sticker price + lore → they ship it in → mark received → List), the card
  sits in the On Consignment case ("that one's Maya's"), and when it sells the Stripe webhook
  writes an owed payout at their split — settled manually and marked paid in the ledger. RLS + a
  guard trigger keep sellers away from price/status/lore. Spec: `docs/SPEC-consignment.md`.
- **Hold pile, not a basket.** Cards you want fly to a pile on the counter — Chris holds them up
  front — with a small HUD chip; at the counter, click a pile card to put it back, then check out.
- **Sign-in: Google or email magic link.** Both resolve to one Supabase user per email.
- **Hold a card up and ask Chris.** From any shelf, "Ask Chris" (or `A`) has Chris walk out from
  behind the counter to you, the camera turns to him, and his take on *that* card streams into a
  speech bubble; then he walks back. The held card + station ride the user turn (never the cached
  system prompt). Maya offers a line about the top slab when you reach the case.
- **Cards are data; positions are derived.** `placement.ts` maps inventory → shelf slots with
  seeded jitter. Moving a shelf never touches card data.
- **Refractors flash when you tilt them.** Foils and non-base parallels get a clearcoat/iridescent
  material in hand plus a light band that sweeps across the face as you tilt (with a shimmer sound);
  shelf cards keep the cheap foil shader.
- **The Collection.** A small annex through a doorway beside the hockey shelf (next to the
  back-office door): Chris's personal collection (Indianapolis Colts today) in its own case — cards with
  `status: 'personal'` that you can pick up and inspect but never buy — plus memorabilia (framed
  #18/#88 jerseys, pennants, ticket stubs, a signed ball on a plinth, a salvaged stadium seat), all
  procedural primitives, no team marks. Chris knows every piece (`shared/data/showcase.ts` rides
  the grounding prompt) and won't sell any of it.
- **Bins you actually dig through.** Bargain bins are a front-to-back stack: scroll (or ←/→) to thumb
  through — cards flick forward and the one under your thumb stands up; click it to pick it up, or
  click a buried card to jump to it.
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

Next: an actual back room behind the STAFF ONLY door (desk computer that opens the panel
in-world); a Meshy helmet + your own photos for the Collection. Then: Stripe checkout, first-person WASD (the nav rig is already a swappable
component), pack-ripping, and richer Chris. See the plan doc for detail.

- **Consignment (outside sellers) and a trade room** — idea-phase think-through with staged
  data models in [`docs/IDEAS-consignment-and-trade-room.md`](docs/IDEAS-consignment-and-trade-room.md).
- **Branded Google sign-in.** The consent screen currently says "Sign in to
  `<ref>.supabase.co`" because Google shows the redirect URI's domain for unverified apps.
  Fix: Supabase custom domain (Pro + add-on, e.g. `api.toploadercards.com`) → update the Google
  client's redirect URI/origins + `VITE_SUPABASE_URL` → then optionally publish the OAuth
  consent screen with `toploadercards.com` as an authorized domain (needs privacy/terms pages +
  Search Console verification) so it reads "Sign in to GEM". Deferred — not needed yet.

Football card scans in `public/cards/football/` are 1894 Mayo Cut Plug cards via Wikimedia
Commons / The MET Open Access (public domain).
