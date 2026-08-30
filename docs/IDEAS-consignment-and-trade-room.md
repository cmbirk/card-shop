# Ideas: outside sellers (consignment) & a trade room

Status: **idea phase — nothing implemented** (feature-scout think-through, 2026-08-29). Both
features converge on one trust step — *ship it to Chris* — so intake tracking in the back office
should be built once and shared.

## 1. Outside sellers — consignment, not a marketplace

**How it'd feel.** A glass Consignment Case near the counter, each card with a handwritten tag.
Pick one up and Chris says "that's Maya's — she pulled it herself, she's firm at forty." Real LCS
consignment: labeled case, shop takes 10–20%, shop rings the sale.

**Decisions (recommended)**
- **Consignment.** GEM stays merchant of record; one Stripe account (Chris); sellers never touch
  checkout. `reserve_cards` / `orders` / webhook reused untouched. Stripe Connect only for strangers.
- **Listing ownership.** Seller submits; Chris owns the live row. Only Chris edits price/lore after
  approval (sellers request changes) — keeps placement + grounding stable.
- **Role.** `sellers` table mirroring `admins` (`is_seller(uid)`), not an admin flag. Seller back
  office = one "My Consignments" tab reusing `CardForm` + `imagePrep` (HEIC upload).
- **Pricing.** Seller proposes `asking_price`; Chris sets `price` on approval (agree/counter — a
  2-message thread).
- **Notifications.** Resend email from the webhook when a consigned card sells + a badge in the
  seller tab. No realtime.
- **Money.** Stages 1–2: manual payouts (Venmo/Zelle) tracked in `payouts` from day one; 1099-NEC
  past $600/yr per seller. Stage 3: Stripe Connect Express, separate charges + transfers held
  through the return window (Connect tooling automates 1099s).
- **Shipping.** Seller ships to Chris on approval; Chris consolidates. One outbound parcel per
  order, one tracking number, no "seller never shipped" failure, and Chris eyeballs condition
  before listing (that *is* the authentication step). Direct-ship only at Stage 3 (EasyPost labels).
- **Disputes/returns.** GEM's policy; refunds come out of the consignor's unpaid balance.

**Staged path**

| Stage | Who | Data model | Effort |
|---|---|---|---|
| 1 Friends | invite-only, ~5 people | `sellers(user_id, invited_by, split_pct, payout_handle)`; `cards.consignor_id`, `cards.consign_status` (submitted→approved→rejected→received→listed→sold→paid), `cards.asking_price`; RLS: seller inserts/reads own rows, can't set `status`/`price`; `cards_public` exposes `consignor_display` only; `payouts(id, seller_id, order_id, card_id, amount, method, paid_at)` | ~1 wk |
| 2 Vetted | referrals; cards received before listing | `consign_events` audit log, `sellers.trust_level`, emails, earnings ledger, `is_seller()` write path on `card-images` | ~1 wk |
| 3 Open | strangers | Stripe Connect Express (`sellers.stripe_account_id`), transfers on `paid_at + return_window`, EasyPost inbound labels, seller ratings | 3–4 wks (legal/tax reality) |

**Risks.** RLS slip letting sellers write `status`/`price` (write a policy test). Consignor names
must ride the user turn, not the cached system prompt. Payout tracking drifting into a spreadsheet.

## 2. Trade room

**How it'd feel.** A side room off `center` (same pattern as The Collection) with a wall of
binders, one per person, name on the spine. Pull a binder, flip 9-pocket pages, click a card,
"Offer a trade" drops both sides onto a felt mat. Chris: "Fair swap… you're giving up a numbered
rookie for base — want me to say something?"

**Decisions (recommended)**
- **Binder per user**, not vendor inventory: `binder_cards` (cards minus commerce/admin fields,
  plus `owner_id`, `for_trade`, `est_value`). Reuses `cardMapping`, procedural art, scan upload,
  the Collection's inspect-can't-buy mechanic. Free for anyone signed in.
- **Offer protocol.** `trade_offers(id, from_id, to_id, status, expires_at, cash_cents,
  parent_offer_id)` + `trade_offer_items(offer_id, binder_card_id, side)`. States
  `open → countered | accepted | declined | expired | completed | canceled`; counter = new offer
  with `parent_offer_id`; accept locks both sides' cards (`binder_cards.locked_offer`, like
  `reserve_cards`). All transitions in one `security definer` RPC.
- **Fulfilment.** Stage 1 honor-system, ship direct, each party marks sent/received.
  GEM-as-escrow (both ship to Chris, he verifies + forwards, small handling fee) is the
  differentiator — Stage 3, and it shares intake with consignment.
- **Chris.** Appraisal + fairness flag from `est_value` sums (deterministic math, Haiku phrases
  it). Never blocks a trade; comments. Rides the user turn.
- **Live trade nights.** Vercel functions can't hold sockets → **Supabase Realtime** (already in
  the project): presence (who's here, which station) + broadcast (ephemeral chat, "X is looking
  at Y's binder"). Ghost avatars: capsule + profile picture badge, positions lerped from presence
  (throttle ~5 Hz, refs in `useFrame`). Text before voice; LiveKit later if it earns it.
  Moderation: block list, Chris ignores flagged users, trade nights gated to `trust_level ≥ 1`.

**Staged path**

| Stage | Slice | Effort |
|---|---|---|
| 1 Binders + offers | tables + RPC; trade-room fixture + binder wall; offer-mat overlay (DOM, like checkout); email on offer/accept | ~2 wks |
| 2 Presence + trade night | Realtime channel `trade-room`; ghost avatars; scheduled `events(id, starts_at, title)` on a chalkboard; text chat | ~1 wk |
| 3 Escrow + voice | `trade_shipments(offer_id, side, tracking, received_at, verified_by)`; Chris intake UI in the back office; optional LiveKit | 3+ wks |

**Risks.** Scams (fake scans, "ship first" pressure) — require scans, show account age + completed
trades, make escrow the default once it exists. Realtime perf. User-uploaded binder images need
per-user storage quotas + a report button.

**Smallest fun version:** trade Stage 1 with just friends' binders, honor-system shipping, and
Chris's fairness comment.

## Queued: persistent test admin for authenticated headless verification
Decision 2026-08-30, not started. API-level testing already works (service-role session minting +
throwaway users for RLS suites — keep that pattern), but headless UI verification can't render
authenticated surfaces (admin panel/Users/Ximilar/seller panels show empty without a JWT), and API
tests currently impersonate the real owner account.

Plan when picked up (~20 min):
- Create `chris+tlc-test@crossroadscx.com` (password auth), row in `admins`, credentials in
  gitignored `.env.local` as `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD`; visibly named so it's
  recognizable in the Users tab.
- `verify.mjs` gains a `signin` action: mint a magic-link `action_link` via the service role and
  navigate Playwright to it → real session in the page → screenshots with real data.
- Keep throwaway users for RLS tests (fresh users prove the fences from a cold start).
- Trade-off accepted for this stage: a standing privileged account in the prod DB. Revisit at
  launch — delete it or move testing to a Supabase branch/local stack (`supabase/SETUP.md`).

## Other queued work
- Ximilar "show Chris a card" (customer photographs their own card → identification → Chris talks
  about it). Requires a Ximilar Business plan; built against the documented API when green-lit.
- `quantity > 1` isn't honoured by checkout (selling one copy marks the row sold) — decide before
  `SOFT_OPENING` flips: decrement, or drop the field.
- Branded Google consent screen (Supabase custom domain).
