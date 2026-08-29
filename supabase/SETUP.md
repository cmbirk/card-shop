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
