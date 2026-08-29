# Supabase setup (one-time)

This stands up the backend for real inventory, admin auth, and card-image
storage. ~10 minutes. Do this once; after that, adding cards is done in the
in-app admin panel.

## 1. Create the project
1. Go to https://supabase.com → New project. Name it `gem-card-shop` (any name).
2. Pick a region near you and a strong database password (save it).
3. Wait for it to provision (~2 min).

## 2. Run the schema
1. In the project, open **SQL Editor** → New query.
2. Paste the entire contents of `supabase/schema.sql` and click **Run**.
   - This creates the `cards` table, the `admins` table + `is_admin()`,
     Row Level Security policies, the customer-safe `cards_public` view, and
     the `card-images` storage bucket + policies.

## 3. Create your admin user
1. **Authentication → Users → Add user** → enter your email + a password
   (email confirm can be off for yourself). Copy the new user's **UUID**.
2. Back in **SQL Editor**, run (paste your UUID):
   ```sql
   insert into public.admins (user_id) values ('<your-auth-user-uuid>');
   ```
   You are now the admin. Anyone else is a customer.

## 4. Get your keys
**Project Settings → API**. Copy three values into `.env.local` (and later into
Vercel → Project → Settings → Environment Variables):

```
VITE_SUPABASE_URL=https://<project>.supabase.co      # "Project URL"
VITE_SUPABASE_ANON_KEY=<anon public key>             # "anon / public"  (browser-safe)
SUPABASE_SERVICE_ROLE_KEY=<service role key>         # "service_role"   (SERVER-ONLY — never VITE_)
```

- The **anon** key is meant to be public; RLS is what protects your data.
- The **service_role** key bypasses RLS — keep it out of the browser. It's only
  used by the seed script and the server-side shopkeeper grounding function.

## 5. Seed the current inventory
Migrates the existing ~120 mock + real cards into the DB so there's one source
of truth (all deletable later from the admin panel):

```bash
node supabase/seed.mjs
```

Expect `Seeded 120 cards into Supabase.` Verify in **Table Editor → cards**.

## 6. Verify it's wired
- Reload the shop — it should look identical, now reading from the DB.
- Try `Ask Chris` in-store; his answers should reflect DB inventory.
- Later: walk into the back office (admin-gated), click the computer, log in,
  add a card with scans — it appears on a shelf on refresh.

## Notes
- **Card images**: the admin panel uploads front/back scans to the `card-images`
  bucket and stores their public URLs on the card. The shop renders those over
  the procedural placeholder art automatically.
- **Vercel**: add the same three env vars to the Vercel project so production
  reads the same database.
