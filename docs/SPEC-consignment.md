# Consignment — Stage 1 spec (invite-only friends)

Source: feature-scout, 2026-08-30. Idea background: `IDEAS-consignment-and-trade-room.md`.
Model: consignment — TLC stays merchant of record, sellers ship to Chris, manual payouts.

## 1. Data model + RLS (one migration, then `npm run db:types`)

- **`sellers`**: `user_id uuid pk → auth.users on delete cascade`, `invited_by uuid`,
  `split_pct int not null default 85` (the seller's keep), `payout_handle text`, `payout_method text`,
  `created_at`. `is_seller(uid)` mirrors `is_admin`. Policies: `sellers_self_read`
  (self or admin), `sellers_admin_write`. Grants mirror `admins`.
- **`cards` columns**: `consignor_id uuid → auth.users on delete set null`, `consign_status text
  check in ('submitted','approved','rejected','received','listed','sold','paid',
  'withdraw_requested','withdrawn')`, `asking_price int`, `consign_note text` (reject/return note).
  Index on `consignor_id`.
- **Enforcement = a `BEFORE INSERT OR UPDATE` trigger `cards_consignor_guard`** (not column grants —
  admins and sellers share the `authenticated` role; not a submissions table — it would double
  cardMapping/placement/import). Admin or service role passes. Otherwise: require
  `consignor_id = auth.uid()`; INSERT forces `consign_status='submitted'`, `price=0`,
  `status='available'`, `featured=false`; UPDATE rejects changes to `price/status/cost_basis/
  featured/lore` and allows only: edit-in-place while `submitted|rejected`, and
  `approved|received|listed → withdraw_requested`. RLS: `cards_seller_insert`/`_update`
  (`is_seller() and consignor_id = auth.uid()` both clauses), `cards_seller_delete`
  (own + `submitted|rejected`). **Write a SQL policy test** (role impersonation) — top risk.
- **`payouts`**: `id`, `seller_id → auth.users on delete set null`, `seller_handle text`
  (snapshot — survives account deletion), `card_id`, `order_id`, `sale_price int`, `split_pct int`,
  `amount int`, `test_mode boolean not null`, `status check ('owed','paid','void')`, `method`,
  `reference`, `paid_at`, `created_at`, `unique (card_id, order_id)` (webhook idempotency).
  Self-read + admin update; inserts service-role only.
- **`cards_public`**: recreate with `where consignor_id is null or consign_status in
  ('listed','sold','paid')`; add `is_consigned`, `consignor_display` (first name from profiles).
  Never expose `asking_price`, `consignor_id`, `split_pct`.
- **Storage**: `card_images_seller_write` insert policy — bucket `card-images`, `is_seller()`,
  path prefix `consign/{auth.uid()}/`.

## 2. Seller experience
- **Invite:** no codes. Friend signs the guestbook; Chris flips a **Seller toggle** in the Users
  tab (`setSeller` in `adminUsers.ts`, `setAdmin` pattern; `split_pct` editable inline).
- **Where:** a DOM overlay `ConsignPanel.tsx` (checkout-panel pattern) opened from a HUD chip when
  `authStore.isSeller` — NOT the 3D office (door stays admin-only).
- **Submit:** `CardForm` gains `mode='seller'`: identity/condition fields + `asking_price` + scans
  (`prepareScan` → `consign/{uid}/`). Hidden: price, status, featured, section, lore, cost basis
  (Chris writes lore on approval — keeps his voice).
- **Timeline chips:** Submitted → Approved (shows ship-to address) → Received → Listed (Chris's
  live price) → Sold → Paid; Rejected shows the note. Edit/delete while submitted|rejected;
  Request return while approved|received|listed.
- **Earnings:** ledger from own `payouts` rows; owed total excludes `test_mode`.

## 3. Chris's experience
- **`ConsignTab`** in the admin panel, sectioned by `consign_status`. Approve = full CardForm (set
  price, lore, section) → `approved` + email. Reject = note + email. **Mark received** on physical
  arrival. Explicit **List** button (Chris eyeballs first) → `listed` + `reloadInventory()`.
  Payouts section: owed rows, Mark paid (method + reference) → card `paid`.
- **3D:** fixture `case-consign` (displayCase, main room near the counter, mirrors `case-premium`,
  `accepts: { consigned: true }`, 2×5, label "On Consignment", own station). `placement.ts` gains a
  `consigned` predicate matched before sport shelves; overflow falls through to sport shelves;
  `InspectHud` shows "Consigned — from {name}".
- **Chris-the-AI:** grounding `where()` adds the consignment case; `cardLine` appends
  `— on consignment from {consignor_display}` (deterministic; ORDER BY id read already ensures
  byte-stability). Persona: sold on the owner's behalf; never reveal asking prices, splits, or
  full names.

## 4. Sale + money
- **Webhook `markPaid`:** after the sold-update, re-select consigned rows; per card insert a
  `payouts` row (`amount = round(sale_price * split_pct / 100)`, `status='owed'`,
  `test_mode = !livemode`, `on conflict do nothing`) and set `consign_status='sold'`. Split lives
  on `sellers`, snapshotted into the payout.
- **Test sales:** `test_mode` payouts grey ("dry run"), excluded from owed totals, Mark-paid
  disabled. No special casing on SOFT_OPENING itself.
- **Email (Resend):** `api/_lib/email.ts` (raw fetch) + `api/consign-notify.ts` (named POST export,
  `.js` imports). Client posts `{cardId, event}` after a successful write; server verifies the
  caller (admin, or consignor for `submitted`) and re-reads state before sending. `sold` fires from
  the webhook (skipped for test_mode). submitted → Chris; approved/rejected/received/listed/sold/
  paid → seller. Env: `RESEND_API_KEY`, `ADMIN_EMAIL`, `CONSIGN_SHIP_ADDRESS`.

## 5. Edge cases
- Account deletion → `consignor_id` null (card flagged orphaned; Chris resolves); payout obligation
  survives via `seller_handle`.
- Lost/damaged in transit → `approved → rejected` + note; never listed.
- Withdraw: seller → `withdraw_requested`; admin confirms → `withdrawn` (off the floor via the
  view). Withdraw disabled while `reserved` with a live `reserved_until`; a completed sale beats a
  pending withdrawal.
- Price changes post-listing: out of band; Chris edits. Seller edits `asking_price` pre-approval only.
- Duplicates: self-delete or reject; no uniqueness constraint (real parallels collide).
- `personal` unreachable for sellers (trigger forbids writing `status`).

## 6. Build order (4 PRs, each shippable)
1. **Schema + roles** — migration, types, `isSeller` in authStore, Seller toggle in UsersTab.
   Verify: SQL policy/trigger test via role impersonation; no second account needed.
2. **Seller submit** — ConsignPanel, CardForm seller mode, `src/admin/consign.ts`, HUD chip.
   Verify headless with a faked seller flag; one real second-account pass for RLS.
3. **Queue + shop floor** — ConsignTab, `case-consign` fixture + station, placement predicate,
   InspectHud tag, grounding + persona. Verify: seed a listed consigned card, screenshot, `ask`.
4. **Money + email** — webhook payouts, email lib + notify route, mark-paid UI, envs. Verify:
   split-math vitest; webhook replay; deployed-function check (Vite mount masks Vercel gotchas).
