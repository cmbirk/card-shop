# Supabase setup (CLI workflow)

Backend for real inventory, admin auth, and card-image storage — managed
through the Supabase CLI so the schema is version-controlled (in
`supabase/migrations/`) instead of pasted into the web SQL editor.

The CLI is a dev dependency, so `npx supabase …` works with no global install.

## 1. Create the project (dashboard, once)
At https://supabase.com → New project. Region near you, save the DB password.
On the "Create a new project" screen keep **Enable Data API** and **Automatically
expose new tables** checked; leave **Enable automatic RLS** unchecked (our
migration turns RLS on explicitly). Grab the **project ref** from the URL or
Project Settings → General (looks like `abcdxyz…`).

## 2. Log in + link (interactive — run these yourself with `!`)
```
! npx supabase login          # opens a browser to authorize the CLI (one time)
! npx supabase link --project-ref <your-project-ref>
```
`link` will ask for the DB password you saved.

## 3. Apply the schema
```
! npm run db:push             # applies supabase/migrations/*.sql to the remote DB
```
This creates the `cards` table, `admins` + `is_admin()`, Row Level Security,
the customer-safe `cards_public` view, and the `card-images` storage bucket +
policies. Re-runnable safely (the migration is idempotent).

## 4. Create your admin user + keys (dashboard)
1. **Authentication → Users → Add user** → your email + password → copy the UUID.
2. In **SQL Editor** (or `npx supabase db execute`), run:
   ```sql
   insert into public.admins (user_id) values ('<your-auth-user-uuid>');
   ```
3. **Project Settings → API** → copy into `.env.local` (and Vercel env):
   ```
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon public key>         # browser-safe (RLS protects data)
   SUPABASE_SERVICE_ROLE_KEY=<service_role key>     # SERVER-ONLY — never prefix with VITE_
   ```

## 4b. Google sign-in (OAuth client)
The guestbook offers **Continue with Google** plus an email magic link. Google needs a
one-time OAuth client:

1. **Google Cloud Console** → https://console.cloud.google.com → create (or pick) a
   project, e.g. `gem-card-shop`.
2. **APIs & Services → OAuth consent screen** → External → app name `GEM`, support email,
   developer email → Save. Scopes: leave defaults (email/profile/openid). While the app is
   in *Testing* only listed test users can sign in — click **Publish app** when ready for
   real customers (no verification is needed for basic email/profile scopes).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**, name `GEM Supabase`
   - **Authorized JavaScript origins:** `https://toploadercards.com`, `http://localhost:5199`
   - **Authorized redirect URIs:** exactly one —
     `https://plifvdhdmeslbweojhhr.supabase.co/auth/v1/callback`
     (Google redirects to *Supabase*, which then bounces back to the app.)
   - Create → copy the **Client ID** and **Client secret**.
4. **Supabase dashboard → Authentication → Providers → Google** → Enable → paste Client ID +
   Client secret → Save.
5. **Supabase → Authentication → URL Configuration:**
   - Site URL: `https://toploadercards.com`
   - Redirect URLs: add `http://localhost:5199/**` and `https://*.vercel.app/**` (preview deploys).
   Without these the post-login bounce lands on the Site URL instead of where you clicked.
6. Test: `npm run dev`, click the front door → **Continue with Google**. Your
   Google account becomes a row in Authentication → Users; add its UUID to `public.admins`
   (step 4) if it's you.

Note: a Google user and a magic-link user with the same email are the **same** Supabase user
(identities are linked by verified email), so the admins row works either way.

## 4d. Visitors + promoting admins
`public.profiles` is filled by triggers on `auth.users` (sign-up + every sign-in) and backfilled by
`20260829130000_profiles.sql`. The Back Office → Users tab lists everyone and has an Admin toggle
(writes the `admins` table under your JWT; you can't demote yourself). The SQL in step 4 is still
the bootstrap for the *first* admin.

## 4c. Personal (not-for-sale) cards
`status = 'personal'` marks a card as Chris's own — it shows in the Collection (showcase annex) case, can be
inspected but not bought, and Chris will talk about it but never price it. Set it from the admin
panel's Status dropdown. The check constraint in `20260829120000_personal_status.sql` limits
`status` to available / reserved / sold / personal.

## 4e. Stripe (test mode)
`.env.local` + Vercel: `STRIPE_SECRET_KEY` (sk_test), `VITE_STRIPE_PUBLISHABLE_KEY`, and
`STRIPE_WEBHOOK_SECRET`. For prod, add a webhook endpoint in the Stripe dashboard →
`https://toploadercards.com/api/stripe-webhook` with events `checkout.session.completed` and
`checkout.session.expired`, and paste its signing secret into Vercel. Locally a throwaway
`whsec_localdev_…` value works for synthetic signed events. Migration `20260830100000_orders.sql`
adds `orders`, `reserve_cards()` / `release_order()`. Test card: 4242 4242 4242 4242.

## 5. Seed + generate types
```
! npm run db:seed             # migrate the 120 bundled cards into the DB
! npm run db:types            # generate src/lib/database.types.ts for typed access
```

## 6. Verify
- Reload the shop — identical, now DB-backed.
- `Ask Chris` reflects DB inventory.
- Later: enter the back office (admin-gated), click the computer, log in, add a
  card with scans → it appears on a shelf on refresh.

## Optional — local stack for offline dev/testing
`npx supabase start` boots a full local Postgres + Studio + Auth (needs Docker).
Point `.env.local` at the local URL/keys it prints to develop and test the admin
flow without touching the cloud project. `npx supabase stop` when done.

## Notes
- **Migrations are the source of truth.** To change the schema, add a new file
  under `supabase/migrations/` (or `npx supabase migration new <name>`) and
  `npm run db:push`. Don't hand-edit tables in the dashboard.
- The old `supabase/schema.sql` is kept as a readable reference; the CLI applies
  the copy under `supabase/migrations/`.
