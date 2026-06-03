# Connodo MVP — Deployment Guide

Complete step-by-step instructions to go from zero to a live, production deployment on **Supabase + Vercel**.

---

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | ≥ 18 | `node --version` |
| npm | ≥ 9 | `npm --version` |
| Git | any | `git --version` |
| Supabase account | free tier | [supabase.com](https://supabase.com) |
| Vercel account | free tier | [vercel.com](https://vercel.com) |

---

## Step 1 — Create a Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard) and sign in.
2. Click **New project**.
3. Fill in:
   - **Name**: `Connodo` (or any name)
   - **Database Password**: generate a strong password and save it somewhere safe
   - **Region**: choose the region closest to your users
4. Click **Create new project** and wait ~2 minutes for provisioning.

---

## Step 2 — Run the Database Schema

1. In your Supabase project dashboard, go to **SQL Editor** (left sidebar).
2. Click **New query**.
3. Copy the **entire contents** of `supabase/schema.sql` from this repo and paste it into the editor.
4. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`).
5. You should see: `Success. No rows returned.`

### Verify the schema was applied correctly

Run each of these verification queries in a new SQL Editor tab:

**Check table columns exist:**
```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'Connodos'
ORDER BY ordinal_position;
```
Expected: 8 rows — `id`, `title`, `nodes`, `edges`, `view_token`, `edit_token`, `owner_token`, `updated_at`.

**Check RLS policies:**
```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'Connodos';
```
Expected: 5 policies — read, insert, canvas update, title update, delete.

**Smoke test — insert a map and verify auto-generated tokens:**
```sql
INSERT INTO Connodos DEFAULT VALUES
RETURNING id, view_token, edit_token, owner_token;
```
Expected: 1 row with 4 UUID values. Delete this test row after:
```sql
DELETE FROM Connodos WHERE title = 'Untitled Map';
```

---

## Step 3 — Get Your Supabase API Credentials

1. In your Supabase dashboard, go to **Project Settings** → **API** (left sidebar).
2. Copy these two values:

| Variable | Where to find it |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Project URL** field (e.g. `https://abcdefgh.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Project API keys** → `anon` `public` key |

> **Security note**: The `anon` key is safe to expose in the browser. It has no privileges beyond what RLS policies allow. Never use the `service_role` key in client-side code.

---

## Step 4 — Configure Local Development

1. Open `Connodo-app/.env.local` in your editor.
2. Replace the placeholder values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

3. Start the dev server:
```bash
cd Connodo-app
npm install
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) — you should see the Connodo homepage.

---

## Step 5 — Test Each Access Level Locally

Before deploying, verify all 3 roles work correctly.

### A. Create a new map (owner flow)

1. Go to `http://localhost:3000`
2. Click **Create New Map**
3. You are redirected to `/map/[id]?owner=[token]`
4. ✅ Verify: title bar shows editable title, toolbar shows "＋ Add Node", "⌫ Delete", "🔗 Share"

### B. Test owner controls

1. Click **🔗 Share** — the Share panel should open
2. Verify 3 links are shown: View, Edit, Owner
3. Click **📋 Copy** on each — should show "✓ Copied!" for 2 seconds
4. Verify the amber warning box appears under the Owner link
5. Copy the **View link** and **Edit link** URLs — you'll need them next

### C. Test editor access

1. Open a new **incognito/private** browser window
2. Paste the **Edit link** URL
3. ✅ Verify: toolbar shows "＋ Add Node" and "⌫ Delete" but NO "🔗 Share" button
4. Add a node — it should appear and auto-save (watch for "✓ Saved" badge)
5. Go back to your owner tab and refresh — the new node should persist

### D. Test viewer access

1. Open another incognito window
2. Paste the **View link** URL
3. ✅ Verify: role badge shows "👁 View only"
4. ✅ Verify: no Add Node / Delete buttons visible
5. ✅ Verify: nodes are not draggable (try clicking and dragging — should not move)
6. ✅ Verify: Export dropdown is present and accessible

### E. Test rename (owner only)

1. In the owner tab, click the map title at the top
2. Type a new title and press **Enter**
3. Refresh the page — title should persist
4. ✅ Verify the title is updated in the DB:
   ```sql
   SELECT id, title FROM Connodos ORDER BY updated_at DESC LIMIT 1;
   ```

### F. Test export

1. In any tab (owner/editor/viewer), click **Export ▾**
2. Test **JSON**: should download a `.json` file with `{ title, nodes, edges }`
3. Test **PNG**: should download a `.png` screenshot of the canvas
4. Test **PDF**: should download a `.pdf` file

### G. Test delete (owner only)

1. Create a **second** test map (go back to `/` and create another)
2. Open its Share panel → click **🗑 Delete Map**
3. Click **Delete** in the confirmation
4. ✅ Verify: redirected to `/`
5. ✅ Verify the map is gone from DB:
   ```sql
   SELECT COUNT(*) FROM Connodos;
   ```

---

## Step 6 — Deploy to Vercel

### Option A: Deploy via Vercel CLI (recommended)

```bash
# Install Vercel CLI if you don't have it
npm install -g vercel

# From the Connodo-app directory
cd Connodo-app
vercel

# Follow the prompts:
# - Link to existing project? No → create new
# - Project name: Connodo (or any)
# - Root directory: ./ (current)
# - Override build settings? No
```

When prompted to add environment variables, enter:
- `NEXT_PUBLIC_SUPABASE_URL` → your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → your Supabase anon key

### Option B: Deploy via Vercel Dashboard (GitHub integration)

1. Push this repo to GitHub.
2. Go to [https://vercel.com/new](https://vercel.com/new).
3. Click **Import Git Repository** → select your repo.
4. Set **Root Directory** to `Connodo-app`.
5. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Click **Deploy**.

---

## Step 7 — Post-Deploy Verification

After Vercel finishes (usually ~2 minutes):

1. Open your production URL (e.g. `https://Connodo-xyz.vercel.app`)
2. Repeat the **Step 5 access level tests** against the live URL
3. Confirm share links contain the production domain (not `localhost`)

### Expected Vercel build output
```
Route (app)
┌ ○ /
├ ○ /_not-found
└ ƒ /map/[id]
```
- `/` — static homepage
- `/map/[id]` — dynamic server-rendered map page (reads token from searchParams)

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Yes | Supabase project URL from Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Yes | Supabase anon public key from Project Settings → API |

No other environment variables are needed. The `anon` key is safe to expose — it is scoped to RLS-enforced operations only.

---

## Troubleshooting

### "Map not found or access denied" on load
- The token in the URL does not match any row in the DB, or the map was deleted.
- Check: is the Supabase URL and anon key correct in `.env.local` / Vercel env vars?
- Check: did the schema.sql run successfully? Run the verification queries in Step 2.

### "Could not create map" on homepage
- Supabase credentials are wrong or missing.
- Open browser DevTools → Network tab → look for the failed Supabase REST call.
- Confirm `NEXT_PUBLIC_SUPABASE_URL` does NOT have a trailing slash.

### Changes not saving (no "✓ Saved" badge)
- Check browser console for Supabase errors.
- Confirm the `anon` key has INSERT and UPDATE permissions (RLS policies applied).
- Confirm `updated_at` trigger was created (check Step 2 verification).

### Export (PNG/PDF) produces a blank image
- `html-to-image` captures the DOM — it needs the canvas to be fully rendered.
- Make sure you have at least one node on the canvas before exporting.
- If behind a CORS-restricted CDN, `html-to-image` may fail on external fonts — this app uses system fonts so it should not be an issue.

### Vercel build fails with "Missing Supabase environment variables"
- The env vars are not set in Vercel dashboard.
- Go to Vercel → Project → Settings → Environment Variables and add both vars.
- Redeploy after adding them.

---

## Schema Quick Reference

```sql
-- Connodos table
id           UUID        PRIMARY KEY DEFAULT gen_random_uuid()
title        TEXT        NOT NULL    DEFAULT 'Untitled Map'
nodes        JSONB       NOT NULL    DEFAULT '[]'
edges        JSONB       NOT NULL    DEFAULT '[]'
view_token   UUID        NOT NULL    DEFAULT gen_random_uuid()
edit_token   UUID        NOT NULL    DEFAULT gen_random_uuid()
owner_token  UUID        NOT NULL    DEFAULT gen_random_uuid()
updated_at   TIMESTAMPTZ NOT NULL    DEFAULT NOW()

-- RLS policies (all TO anon)
SELECT  → Allow read with any valid token   (USING true — token enforced by .eq() filter)
INSERT  → Allow insert for anon             (WITH CHECK true)
UPDATE  → Allow canvas update with edit token  (USING true)
UPDATE  → Allow title update with owner token  (USING true)
DELETE  → Allow delete with owner token     (USING true)

-- Indexes
idx_Connodos_view_token   ON Connodos (view_token)
idx_Connodos_edit_token   ON Connodos (edit_token)
idx_Connodos_owner_token  ON Connodos (owner_token)

-- Trigger
set_updated_at  BEFORE UPDATE → sets updated_at = NOW()
```

---

## Access URL Patterns

| Role | URL format | Capabilities |
|------|-----------|--------------|
| Owner | `/map/[id]?owner=[owner_token]` | Edit canvas, rename title, share panel, delete map, export |
| Editor | `/map/[id]?edit=[edit_token]` | Edit canvas, export |
| Viewer | `/map/[id]?view=[view_token]` | Read-only, export |

The owner token is also persisted to `localStorage` under key `Connodo_owned_[id]`, so the owner can return to `/map/[id]` without the token in the URL and still get full access.
