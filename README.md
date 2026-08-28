# GEM — a 3D card shop you can walk through

A browser-based trading-card shop built like a game, not a storefront. You arrive outside
the shop at dusk, click the front door, and step into a cozy hobby shop: browse cards by
sport on wooden shelves, dig through bargain bins, admire the graded slabs in the glass
case, pick any card up to flip and inspect it, drop it in your basket, and bring it to
the counter — where Mel, the AI shopkeeper (Claude-powered), knows every card in stock.

Built with React Three Fiber + Vite + TypeScript, deployed on Vercel.

## Run it

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY (only needed for the AI shopkeeper)
npm run dev:client           # plain Vite dev server — everything works, chat included
# or, for highest Vercel fidelity:
npm run dev                  # vercel dev (requires `vercel` login + link)
```

Open http://localhost:5173. Without an API key everything still works except live chat —
Mel falls back to an in-character "the intercom's out" line.

```bash
npm test        # placement determinism, money math, AI grounding coverage
npm run build   # type-check + production build
```

## Deploy (Vercel)

Push to GitHub → import the repo in Vercel (Vite preset is auto-detected) → set
`ANTHROPIC_API_KEY` (and optionally `SHOPKEEPER_MODEL`, default `claude-haiku-4-5`) in
Environment Variables → deploy. The static frontend goes to the CDN; `api/chat.ts` and
`api/health.ts` become Node serverless functions on the same origin. Every push gets a
preview URL.

## How it's put together

```
shared/          types + data used by both the game and the API
  types.ts       Card, ShopLayout, Station, chat wire types
  data/shopLayout.ts   every fixture, station pose, and slot grid — single source of truth
  data/inventory.json  ~110 generated mock cards (npm run gen:inventory)
  data/realCards.json  real-image pilot cards (scans in public/cards/)
api/             Vercel serverless functions (web-standard handlers)
  chat.ts        POST /api/chat → SSE stream from Claude
  _lib/shopkeeper.ts     Mel's persona + cached, inventory-grounded system prompt
  _lib/inventoryContext.ts inventory → grounding text, grouped by shop location
src/
  feel.ts        every animation duration/ease — tune the whole game in one file
  stores/        zustand: nav, basket, inspect, dialogue, ui/checkout
  systems/       placement (inventory → shelf slots), rng, sfx, card registry
  scene/         Shop, Facade (exterior), StationController (glide nav), fixtures,
                 Shopkeeper (Mel), Basket, cards/ (atlas, procedural art, interactions)
  ui/            DOM overlays: chat window, basket, inspect HUD, checkout modal
```

Notable mechanics:

- **Cards are data, positions are derived.** `placement.ts` deterministically assigns
  inventory to fixture slots (seeded jitter for the "riffled bin" look). Moving a shelf
  never touches card data.
- **Procedural card art.** Every card face is canvas-generated (fictional players/teams —
  licensing-safe), packed into 2048² texture atlases. A card with `images.front` gets its
  real scan painted over its atlas cell the moment it loads — see the 1894 Mayo football
  cards. Picked-up cards get 512×716 detail textures (per-card stat tables on the back).
- **No physics engine.** Pickup/flip/basket are choreographed damped tweens (`maath`) —
  deterministic, interruptible, tuned in `feel.ts`.
- **AI shopkeeper.** Client-owned conversation, stateless serverless function, the whole
  inventory in a prompt-cached system prompt (turns 2+ hit Anthropic's provider-side
  cache), basket context rides on the user turn. Streamed over SSE.
- **WASD-ready.** Navigation is intent in `navStore`; the camera rig is a swappable
  component. A future `WalkController` (pointer lock + WASD) mounts without touching
  anything else.

## Roadmap

See the plan document for detail. Short version: first-person walking mode, real
inventory + scans (PSA cert ingestion, image management), Stripe checkout, and a realism
pass (PBR materials, real shelving, a proper Mel).

Card scans in `public/cards/football/` are 1894 Mayo Cut Plug cards via Wikimedia
Commons / The MET Open Access (public domain).
