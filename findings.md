# Machine Center — Findings

> Research, discoveries, and constraints. Updated when new learnings emerge.

---

## Architecture Findings

### 1. IndexedDB is per-origin (2026-02-22)
- IndexedDB data is scoped to `protocol + host + port`
- Port 4173 and port 5173 have **separate databases**
- This is why we migrated to Supabase — both ports now share cloud data

### 2. Dexie API surface is simple (2026-02-22)
- The entire app uses these Dexie methods: `.toArray()`, `.get()`, `.add()`, `.bulkAdd()`, `.put()`, `.update()`, `.delete()`, `.clear()`, `.count()`, `.where().equals()`, `.orderBy()`, `.filter()`, `.toCollection().modify()`, `.transaction()`
- All were replicated in the Supabase wrapper except `.transaction()` which was replaced with sequential calls (safe for single-user)

### 3. Vite environment variables (2026-02-22)
- Must use `VITE_` prefix for client-side access
- Available via `import.meta.env.VITE_*`
- `import.meta.env.DEV` is true in dev server, false in production builds — used for the DEV badge

### 4. Supabase camelCase ↔ snake_case (2026-02-22)
- TypeScript uses camelCase (`machineNodeId`)
- PostgreSQL uses snake_case (`machine_node_id`)
- Auto-conversion in `toSnake()`/`toCamel()` handles most cases
- **Exception:** multi-word fields like `machineNodeId` → `machine_node_id` need explicit field maps because auto-conversion produces `machine_node_id` but the naive regex would give `machinenode_id`
- Field maps are defined per table in `src/db/index.ts`

### 5. TypeScript erasableSyntaxOnly (2026-02-22)
- The project uses `erasableSyntaxOnly` mode in tsconfig
- This means: no `private`, `protected`, `public` keywords on class members
- No parameter properties in constructors (must use explicit field declarations)
- Enums are also not allowed — use `as const` objects instead

### 6. ReactFlow node types (2026-02-22)
- Custom node types registered via `nodeTypes` object
- Nodes carry `MachineNodeData` as their data payload
- Group nodes (type: machine) can contain child nodes — this is how recursive machines work

---

## Supabase Findings

### 1. RLS policies required (2026-02-22)
- Even with anon key, Row Level Security must be enabled
- For single-user: `CREATE POLICY "Allow all" ON table FOR ALL USING (true) WITH CHECK (true)`
- Applied to all 11 tables

### 2. Free tier limits (2026-02-22)
- 500MB database storage
- 50,000 monthly active users
- Unlimited API requests
- More than enough for single-user tool

---

## UI/UX Findings

### 1. Collapsible component pattern (2026-02-22)
- Used for progressive disclosure across Overview Panel, Ops Panel, SOP steps
- Props: `title`, `badge`, `badgeColor`, `defaultOpen`, `children`
- Auto-opens when items exist (`defaultOpen={items.length > 0}`)

### 2. Attention system thresholds (2026-02-22)
- Problems: amber 3d, red 7d, critical 14d
- Staleness: amber 7d, red 14d, critical 21d
- Captures: amber 1d, red 2d, critical 3d
- Blocked: amber 3d, red 7d, critical 14d

---

*Last updated: 2026-02-22T14:28:00+01:00*
