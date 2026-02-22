# Machine Center — Project Constitution

> This file is **law**. All schemas, rules, and invariants live here.
> Updated only when: a schema changes, a rule is added, or architecture is modified.

---

## 🎯 North Star

**Build a visual operating system for personal machines** — a tool that lets one person design, operate, and evolve interconnected business systems through a whiteboard interface with real-time operational intelligence.

---

## 📊 Data Schemas

### Source of Truth: **Supabase (PostgreSQL)**

| Table | Purpose | Key Fields |
|---|---|---|
| `nodes` | Machines, SOPs, Tools, Skills, Notes | `id`, `parent_id`, `type`, `status_id`, `position`, `steps` |
| `edges` | Connections between nodes | `id`, `parent_id`, `source`, `target`, `relationship` |
| `statuses` | Status definitions | `id`, `label`, `color`, `icon`, `order` |
| `problems` | Logged problems per node | `id`, `machine_node_id`, `severity`, `status` |
| `victory_conditions` | Measurable goals per node | `id`, `machine_node_id`, `target`, `current`, `met` |
| `vc_snapshots` | Time-series metric history | `id`, `victory_condition_id`, `value`, `recorded_at` |
| `status_changes` | Status change audit trail | `id`, `machine_node_id`, `from_status_id`, `to_status_id` |
| `levers` | Adjustable parameters per node | `id`, `machine_node_id`, `label`, `current_value` |
| `principles` | Operating principles per node | `id`, `machine_node_id`, `text` |
| `captures` | Quick-capture inbox items | `id`, `text`, `machine_id`, `processed` |
| `events` | Universal event log | `id`, `node_id`, `event_type`, `timestamp`, `previous_value`, `new_value` |

### Default Statuses (seeded in SQL)
```
running | under | blocked | not-built | optimizing | paused
```

### Node Types
```
machine | sop | tool | skill | note
```

### Problem Severities
```
critical > high > medium > low
```

### Problem Statuses
```
open → diagnosing → planned → fixing → resolved
```

### Event Types
```
status-change | problem-logged | problem-resolved | problem-updated
metric-updated | metric-snapshot | step-completed | step-uncompleted
note-updated | node-created | node-deleted | capture-processed
```

---

## 🧱 Architectural Invariants

1. **Frontend-only app** — no backend server. Supabase serves as both database and API.
2. **camelCase in TypeScript, snake_case in Postgres** — the DB layer (`src/db/index.ts`) handles translation automatically via field maps.
3. **Single-user tool** — no auth required. RLS policies allow all access via anon key.
4. **Machines are recursive** — a machine node can contain child machines, creating infinite depth.
5. **Data is never deleted on promote** — `npm run promote` only replaces static files (HTML/JS/CSS). Supabase data is untouched.
6. **DEV badge** — `import.meta.env.DEV` controls the orange DEV badge. Production builds strip it automatically.

---

## 🔐 Environment Variables

```env
VITE_SUPABASE_URL=https://fsogymxttriasxuujlzf.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...  (stored in .env, gitignored)
```

---

## 🏗️ Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| UI Framework | React 19 + TypeScript | Component architecture |
| Routing | react-router-dom v7 | SPA navigation |
| Whiteboard | @xyflow/react v12 | Node graph visualization |
| Database | Supabase (PostgreSQL) | Cloud data persistence |
| DB Client | @supabase/supabase-js | API layer |
| Icons | lucide-react | Consistent iconography |
| IDs | uuid v13 | Unique identifiers |
| Build | Vite 7 | Dev server + production builds |
| Hosting (stable) | localhost:4173 / Vercel (planned) | Static file serving |

---

## 🚫 Do-Not Rules

1. **Do NOT use IndexedDB/Dexie** — fully migrated to Supabase.
2. **Do NOT hardcode data** — all data comes from Supabase tables.
3. **Do NOT add authentication** — this is a single-user tool.
4. **Do NOT modify `/stable` directly** — only `npm run promote` updates it.
5. **Do NOT add dependencies without explicit approval** — the bundle is already 650KB.
6. **Do NOT mix CSS frameworks** — vanilla CSS only, organized by page.

---

## 📁 File Structure

```
├── gemini.md              # THIS FILE — Project Constitution
├── .env                   # Supabase credentials (gitignored)
├── architecture/          # Layer 1: SOPs and technical docs
├── scripts/               # Layer 3: Build/deploy tools
│   ├── promote.sh         # Type-check → build → copy to stable
│   ├── serve-stable.sh    # Serve production on port 4173
│   ├── rollback.sh        # Revert to previous stable build
│   └── backup-data.mjs    # Check for data backups
├── src/                   # Application source code
│   ├── db/index.ts        # Supabase client + table wrappers
│   ├── types/index.ts     # TypeScript interfaces + helpers
│   ├── components/        # Reusable UI components
│   ├── hooks/             # Custom React hooks
│   ├── pages/             # Page-level components
│   └── styles/            # CSS organized by page
├── supabase/              # Database schema
│   └── schema.sql         # Full Supabase DDL
├── stable/                # Production build (auto-generated)
└── .agents/               # Antigravity agent config
    └── workflows/         # Slash-command workflows
```

---

*Last updated: 2026-02-22T14:28:00+01:00*
