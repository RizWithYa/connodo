# 🗺️ Connodo

> **Think freely. Share instantly.**

A frictionless, lightweight web-based mind-mapping tool. Create Connodos and share them with anyone — no account required.

🔗 **Live Demo:** [Connodo-phi-tawny.vercel.app](https://Connodo-phi-tawny.vercel.app/)

---

## ✨ Features

### 🔗 Frictionless Sharing

- No login or account needed for anyone
- 3-level access control via tokenized URLs:
  - **Owner** — full control (edit, rename, delete, share)
  - **Editor** — edit canvas freely
  - **Viewer** — read-only, zoom & pan

### 🎨 Canvas

- Drag, connect, and arrange nodes freely
- Connect from **any side** of a node (top, bottom, left, right)
- Quick add `+` button on all 4 sides — instantly create connected nodes
- Double-click empty canvas to create a node at that position
- Node color picker — 8 preset colors per node
- Inline text editing with auto-sizing textarea

### ⌨️ Keyboard Shortcuts

| Shortcut                | Action                 |
| ----------------------- | ---------------------- |
| `Tab`                   | Create child node      |
| `Enter`                 | Create sibling node    |
| `F2`                    | Edit selected node     |
| `Ctrl+Z`                | Undo (20 steps)        |
| `Ctrl+Y`/`Ctrl+Shift+Z` | Redo                   |
| `Ctrl+C`/`Ctrl+V`       | Copy / Paste nodes     |
| `Ctrl+D`                | Duplicate node         |
| `Ctrl+A`                | Select all             |
| `Delete`                | Delete selected        |
| `Escape`                | Deselect / cancel edit |

### 💾 Smart Sync

- Auto-saves every 1.5 seconds (debounced)
- Last-write-wins — no conflicts, no WebSockets
- Save status indicator (Saving / Saved / Failed)

### 📤 Export

- Export as **PNG** , **PDF** , or **JSON**

### 🏠 Homepage

- See all your previously created maps (stored locally)
- Reopen, rename, or delete maps from one place

---

## 🛠️ Tech Stack

| Layer      | Technology                   |
| ---------- | ---------------------------- |
| Framework  | Next.js 16 (App Router)      |
| Styling    | Tailwind CSS + shadcn/ui     |
| Canvas     | React Flow (`@xyflow/react`) |
| Database   | Supabase (PostgreSQL)        |
| Export     | `html-to-image`+`jsPDF`      |
| Deployment | Vercel                       |

**Infrastructure cost: $0/month** — fully free tier.

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/RizWithYa/Connodo.git
cd Connodo/Connodo-app
npm install
```

### 2. Setup Supabase

1. Create a free project at [supabase.com](https://supabase.com/)
2. Run `supabase/schema.sql` in the Supabase SQL Editor
3. Copy your **Project URL** and **anon key**

### 3. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000/)

---

## 🗄️ Database Schema

```sql
CREATE TABLE Connodos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL DEFAULT 'Untitled Map',
  nodes       JSONB NOT NULL DEFAULT '[]',
  edges       JSONB NOT NULL DEFAULT '[]',
  view_token  UUID NOT NULL DEFAULT gen_random_uuid(),
  edit_token  UUID NOT NULL DEFAULT gen_random_uuid(),
  owner_token UUID NOT NULL DEFAULT gen_random_uuid(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 📁 Project Structure

```
Connodo-app/
├── app/
│   ├── page.tsx              ← Homepage + map list
│   └── map/[id]/page.tsx     ← Canvas page
├── components/
│   ├── ConnodoCanvas.tsx     ← React Flow canvas + all logic
│   ├── MapTitle.tsx          ← Inline editable title
│   ├── Toolbar.tsx           ← Controls + export + share
│   ├── SharePanel.tsx        ← Share links modal
│   └── NodeEditor.tsx        ← Inline text editor
├── lib/
│   ├── supabase.ts           ← Supabase client + token client
│   ├── useDebounce.ts        ← 1500ms debounce hook
│   ├── exportUtils.ts        ← PNG/PDF/JSON export
│   └── tokenUtils.ts         ← Token resolution
└── supabase/
    └── schema.sql            ← Table + RLS policies + GRANTs
```

---

## 🔒 How Access Control Works

Every map has 3 tokens generated on creation:

```
/map/[id]?owner=[token]  → Full control
/map/[id]?edit=[token]   → Edit canvas only
/map/[id]?view=[token]   → Read-only
```

Tokens are verified at the **database level** via Supabase RLS policies using a custom `x-connodo-token` header. The server never trusts the client alone.

Owner token is stored in `localStorage` so you can always reopen your maps from the homepage.

---

## 📄 License

MIT — free to use and modify.

---

<p align="center">Built with Next.js · Supabase · React Flow · Vercel</p>
