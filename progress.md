# Machine Center — Progress Log

> What was done, errors encountered, tests run, and results. Append-only.

---

## 2026-02-22 — Supabase Migration & B.L.A.S.T. Alignment

### Done ✅
- Created `.env` with Supabase credentials (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)
- Added `.env` to `.gitignore`
- Installed `@supabase/supabase-js`
- Wrote full SQL schema → `supabase/schema.sql` (11 tables, indexes, RLS policies, default status seeds)
- Rewrote `src/db/index.ts` from Dexie → Supabase:
  - Created `SupabaseTable<T>` generic class
  - Implemented camelCase ↔ snake_case field mapping
  - Preserved full Dexie API surface: `.toArray()`, `.get()`, `.add()`, `.bulkAdd()`, `.put()`, `.update()`, `.delete()`, `.clear()`, `.count()`, `.where().equals()`, `.filter()`, `.orderBy()`, `.toCollection().modify()`
- Fixed Whiteboard.tsx: replaced `db.transaction()` with sequential calls
- Added `MachineEvent` to Whiteboard imports
- Removed `private` keywords from SupabaseTable (erasableSyntaxOnly compliance)
- Removed unused `toCamelArray` function

### Tests Run ✅
- `npx tsc --noEmit` → 0 errors
- `npm run build` → success (657KB JS, 60KB CSS)

### Errors Encountered & Fixed
1. **`db.captures.filter()` not found** → Added `.filter()` method to SupabaseTable (client-side filter + sort + count + delete)
2. **`db.transaction()` not found** → Replaced with sequential awaits in handleDeleteNode
3. **`MachineEvent` not imported** → Added to type imports in Whiteboard.tsx
4. **`private` keyword not allowed** → Removed from all SupabaseTable methods (erasableSyntaxOnly)
5. **`toCamelArray` unused** → Removed

### Blocked ⏳
- **SQL schema not yet executed in Supabase** — user needs to paste `supabase/schema.sql` in SQL Editor and click Run

---

## 2026-02-22 — Operational Intelligence Features (Earlier Session)

### Done ✅
- Applied Collapsible component to: MachineOpsPanel (problems), Machine Overview (all sections), SopPanel (steps)
- Added event logging: `handleUpdateVC`, `recordSnapshot`, `toggleStep`
- Created `timeSinceEvent()` utility
- Added "Dismiss All" button to AttentionPanel
- Built Machine Overview Panel (status breakdown, blocked nodes, bottlenecks, problems, VCs)
- Set up dual-environment: dev (port 5173) + stable (port 4173)
- Created promote/rollback scripts
- Added DEV badge (import.meta.env.DEV only)

---

## 2026-02-22 — B.L.A.S.T. Protocol Alignment

### Done ✅
- Created `gemini.md` → Project Constitution (schemas, rules, invariants)
- Created `task_plan.md` → Phase tracker with checklists
- Created `findings.md` → Technical learnings and constraints
- Created `progress.md` → This file
- Created `architecture/` → SOPs for key systems
- Aligned file structure with B.L.A.S.T. protocol (adapted for TypeScript/React)

---

*Last updated: 2026-02-22T14:28:00+01:00*
