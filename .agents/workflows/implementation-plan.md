---
description: 5-Phase implementation plan — Capture Engine → Processing Flow → Progressive Disclosure → Time Awareness → Active Layer
---

# Machine Center: 5-Phase Implementation Plan

> **Codebase baseline as of 2026-02-21.**
> Current state: React 19.2 + Vite 7.3 + TypeScript 5.9 + Dexie.js + @xyflow/react.
> Files: `src/db/index.ts` (v5, 9 tables), `src/types/index.ts` (18 interfaces), `src/pages/Dashboard.tsx`, `src/pages/Whiteboard.tsx`, `src/App.tsx` (2 routes), `src/styles/` (3 CSS files), `src/components/` (ErrorBoundary, FlowNodes).

---

## What Already Exists (Don't Rebuild These)

| Capability | Location | Status |
|---|---|---|
| Status change tracking | `statusChanges` table + `handleUpdateNode` in Whiteboard.tsx | ✅ Working |
| Problem timestamps | `Problem.createdAt`, `Problem.resolvedAt` | ✅ Working |
| Time-since display | `daysSince()`, `formatDaysSince()` in types/index.ts | ✅ Working |
| VC snapshots (time series) | `vcSnapshots` table + MetricsPanel snapshot button | ✅ Working |
| Problem severity ordering | `PROBLEM_SEVERITY_ORDER` + sort in MachineOpsPanel | ✅ Working |
| Loop speed metric | Dashboard calculates avg days-to-resolve | ✅ Working |
| JSON export/import | Dashboard Data dropdown | ✅ Working |

---

## Phase 1: The Capture Engine

**Goal:** Ability to capture thoughts/observations from ANY page without leaving context.
**Effort:** ~1 session. One table, one component, one keyboard shortcut.

### 1.1 — Dexie Migration (db/index.ts)

Add `captures` table to db version 6:

```
New table schema:
  captures: 'id, machineId, processed, createdAt'
```

New type in `types/index.ts`:
```typescript
export interface Capture {
  id: string;
  text: string;
  machineId: string;     // auto-set to last-viewed machine, '' if on dashboard
  processed: boolean;    // false by default
  createdAt: Date;
}
```

**Files to modify:**
- `src/types/index.ts` — add `Capture` interface
- `src/db/index.ts` — add version 6 with `captures` table, add `EntityTable<Capture, 'id'>` to db type, add `captures` to export JSON and import in Dashboard.tsx

### 1.2 — CaptureBar Component (NEW: src/components/CaptureBar.tsx)

Floating component that renders on every page. Anatomy:

```
┌─────────────────────────────────────────┐
│  💡  [Type a quick thought...] [Enter]  │  ← collapsed: just a FAB button
└─────────────────────────────────────────┘
```

**Behavior:**
- Renders in `App.tsx` outside `<Routes>`, so it appears on Dashboard AND Whiteboard
- Toggle open with `⌘+.` (Cmd+Period) or clicking the FAB
- When open: single text `<input>`, focus immediately
- On Enter: write to `captures` table with `processed: false`, auto-detect `machineId` from current URL (parse `/machine/:id` from `window.location.pathname`), clear input, show brief "✓ Captured" flash
- On Escape: close
- Badge shows count of unprocessed captures (query `captures.where('processed').equals(false).count()`)

**Files to create:**
- `src/components/CaptureBar.tsx`
- `src/styles/capture-bar.css`

**Files to modify:**
- `src/App.tsx` — render `<CaptureBar />` outside `<Routes>` but inside `<BrowserRouter>`
- `src/pages/Dashboard.tsx` — add unprocessed count badge next to "Inbox" link (Phase 2 prep)

### 1.3 — Track Last Viewed Machine

Add a simple in-memory ref or localStorage value. In `Whiteboard.tsx`, when `machineId` changes, write `localStorage.setItem('lastViewedMachineId', machineId)`. The CaptureBar reads this to auto-tag captures.

No DB needed. Just `localStorage`.

---

## Phase 2: The Processing Flow (Inbox)

**Goal:** Triage captured thoughts into the right place — problems, notes, metrics, or dismiss.
**Effort:** ~1-2 sessions. One new page, reads captures, writes to existing tables.

### 2.1 — Inbox Route (NEW: src/pages/Inbox.tsx)

Add route to `App.tsx`:
```tsx
<Route path="/inbox" element={<Inbox />} />
```

### 2.2 — Inbox Page Design

Query: `db.captures.where('processed').equals(false).reverse().sortBy('createdAt')`

For each capture, render a card:
```
┌──────────────────────────────────────────────────────┐
│  "The follow-up email sequence isn't converting"      │
│  Captured 2h ago · from Sales Machine                 │
│                                                       │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌─────────┐ │
│  │ ⚠ Problem│ │ 📝 Note  │ │ 📊 Metric │ │ Dismiss │ │
│  └──────────┘ └──────────┘ └───────────┘ └─────────┘ │
│                                                       │
│  Machine: [▾ Sales Machine (last viewed)]             │
│  Node:    [▾ Select child node...]                    │
└──────────────────────────────────────────────────────┘
```

**Action handlers (all use existing db write patterns):**

1. **"⚠ Problem"** → Creates a `Problem` row using `db.problems.add()` (same pattern as `handleAddProblem` in Whiteboard.tsx). Uses capture text as `title`. Sets `severity: 'medium'`, `status: 'open'`. Flips `capture.processed = true`.

2. **"📝 Note"** → Appends capture text to `node.notes` using `db.nodes.update(nodeId, { notes: existing + '\n' + captureText })`. Flips processed.

3. **"📊 Metric"** → Opens a mini-form to pick which VC to update, sets `current` value on the `VictoryCondition` and optionally records a `VCSnapshot`. Flips processed.

4. **"Dismiss"** → Just sets `capture.processed = true`. No other writes.

**Machine/Node selection:**
- Dropdown of root machines: `db.nodes.where('parentId').equals('').toArray()`
- On machine select, load its children: `db.nodes.where('parentId').equals(selectedMachineId).toArray()`
- Default to `capture.machineId` if set, otherwise first machine
- Sort by most recently updated (`updatedAt` desc)

**Files to create:**
- `src/pages/Inbox.tsx`
- `src/styles/inbox.css`

**Files to modify:**
- `src/App.tsx` — add Inbox route
- `src/pages/Dashboard.tsx` — add "Inbox" link/badge in header (next to Search)
- `src/db/index.ts` — add `captures` to export/import functions in Dashboard

### 2.3 — Dashboard Inbox Badge

In Dashboard header, between Search and Data buttons:
```tsx
<button onClick={() => navigate('/inbox')} className="btn btn-ghost btn-sm">
    📥 Inbox {unprocessedCount > 0 && <span className="inbox-badge">{unprocessedCount}</span>}
</button>
```

---

## Phase 3: Progressive Disclosure

**Goal:** Every component shows summary by default, details on demand. Less noise, faster scanning.
**Effort:** ~1-2 sessions. Zero new tables. CSS + component refactoring only.

### 3.1 — Collapsible Wrapper (NEW: src/components/Collapsible.tsx)

```typescript
interface CollapsibleProps {
  title: string;
  badge?: string | number;      // summary info always visible
  badgeColor?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}
```

Simple `useState(defaultOpen)` toggle. Chevron rotates 90° on open. Smooth max-height animation via CSS.

**Files to create:**
- `src/components/Collapsible.tsx` (component)
- CSS added to `src/styles/index.css` or new `src/styles/collapsible.css`

### 3.2 — Apply to Existing Components

| Component | Summary (collapsed) | Detail (expanded) |
|---|---|---|
| **Dashboard machine cards** | Name + status dot + goal one-liner | Progress bar, problem count, updated date |
| **Side Panel: Machine Design** | Goal preview (truncated to 1 line) | Full goal + description textareas |
| **Side Panel: Ops tab** | Status dot + problem count badge | Full status grid + bottleneck + problem cards |
| **Side Panel: Metrics tab** | "3/5 met" summary | Full VC rows with target/current values |
| **Side Panel: Notes** | First line preview | Full textarea |
| **Problem cards** | Title + severity badge | Diagnosis + plan + status select |
| **SOP steps list** | "4/7 done" progress bar | Individual step rows with checkboxes |
| **VC rows** | Label + met/unmet icon | Target, current, history |

**Files to modify:**
- `src/pages/Dashboard.tsx` — wrap card detail sections
- `src/pages/Whiteboard.tsx` — wrap side panel sections in `<Collapsible>`
- `src/styles/whiteboard.css` — collapsible animation styles

### 3.3 — Global Detail Level Toggle (Optional V2)

A context or simple localStorage toggle: "Compact / Detailed". When compact, all `<Collapsible>` start closed. When detailed, all start open. Toggle in the Dashboard header. This is a nice-to-have for v2 of this phase — not required for v1.

---

## Phase 4: Time Awareness

**Goal:** Every mutation leaves a timestamped trail. Duration calculations become trivial.
**Effort:** ~1-2 sessions. One new table, minor additions to write functions.

### 4.1 — Events Table (db/index.ts)

Dexie version 7:
```
events: 'id, nodeId, eventType, timestamp'
```

```typescript
export type EventType =
  | 'status-change'
  | 'problem-logged'
  | 'problem-resolved'
  | 'problem-updated'
  | 'metric-updated'
  | 'metric-snapshot'
  | 'step-completed'
  | 'step-uncompleted'
  | 'note-updated'
  | 'node-created'
  | 'node-deleted'
  | 'capture-processed';

export interface MachineEvent {
  id: string;
  nodeId: string;
  eventType: EventType;
  timestamp: Date;
  previousValue?: string;   // serialized old state
  newValue?: string;        // serialized new state
  metadata?: string;        // optional JSON for extra context
}
```

**Files to modify:**
- `src/types/index.ts` — add `EventType`, `MachineEvent`
- `src/db/index.ts` — add `events` table, add to db type declaration, add to export/import in Dashboard

### 4.2 — Shadow-Log Every Mutation

Add one `db.events.add()` call to each existing write function. Here's the exact map:

| Existing Write Function | Location | Event to Log |
|---|---|---|
| `handleUpdateNode` (statusId change) | Whiteboard.tsx:~870 | `status-change` — **ALREADY WRITES to statusChanges table, just add event too** |
| `handleAddProblem` | Whiteboard.tsx:~920 | `problem-logged` |
| `handleUpdateProblem` (status → resolved) | Whiteboard.tsx:~928 | `problem-resolved` |
| `handleUpdateProblem` (other) | Whiteboard.tsx:~928 | `problem-updated` |
| `handleUpdateVC` | Whiteboard.tsx:~940 | `metric-updated` |
| `recordSnapshot` (in MetricsPanel) | Whiteboard.tsx:~510 | `metric-snapshot` |
| `toggleStep` (in SopPanel) | Whiteboard.tsx:~595 | `step-completed` or `step-uncompleted` |
| `handleAddNode` | Whiteboard.tsx:~830 | `node-created` |
| `handleDeleteNode` | Whiteboard.tsx:~1050 | `node-deleted` |
| Process capture (Inbox) | Inbox.tsx | `capture-processed` |

Each is literally one added line, e.g.:
```typescript
await db.events.add({ id: uuid(), nodeId, eventType: 'problem-logged', timestamp: new Date() });
```

### 4.3 — Duration Utility Functions (types/index.ts)

```typescript
// Get time since last event of a given type for a node
export async function timeSinceEvent(nodeId: string, eventType: EventType): Promise<number | null> {
  const event = await db.events.where('[nodeId+eventType]').equals([nodeId, eventType])
    .reverse().sortBy('timestamp').then(arr => arr[0]);
  if (!event) return null;
  return Date.now() - new Date(event.timestamp).getTime();
}

// Format duration as human-readable
export function formatDuration(ms: number): string {
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return 'just now';
}
```

### 4.4 — Relationship to Existing statusChanges Table

The `statusChanges` table already logs from/to status transitions. The new `events` table is a superset — it logs ALL changes, not just status. We keep both:
- `statusChanges` = structured status history (used in the Ops panel timeline)
- `events` = universal event log (used for staleness detection, urgency calculations in Phase 5)

No need to migrate or remove `statusChanges`. They serve different UI purposes.

---

## Phase 5: The Active Layer

**Goal:** Dashboard becomes an operational radar. Stale items get louder. Nothing gets forgotten.
**Effort:** ~2-3 sessions. One new dashboard component, query functions, conditional CSS.

### 5.1 — Dashboard Scan Function (NEW: src/hooks/useDashboardScan.ts)

A custom hook that runs on Dashboard mount and returns an `AttentionItem[]`:

```typescript
interface AttentionItem {
  id: string;
  type: 'stale-problem' | 'stale-node' | 'unmet-vc' | 'blocked-machine' | 'aging-capture';
  title: string;
  subtitle: string;           // e.g., "Open for 12 days on Sales Machine"
  nodeId: string;
  machineId: string;          // root machine id for navigation
  severity: 'normal' | 'amber' | 'red' | 'critical';
  ageDays: number;
  link: string;               // router path to navigate to
}
```

**Scan queries (all run in parallel with Promise.all):**

1. **Stale Problems** — `db.problems.where('status').notEqual('resolved')` → for each, calculate `daysSince(createdAt)`. Flag: >3d normal, >7d amber, >14d red, >21d critical.

2. **Stale Nodes** — `db.events.orderBy('timestamp')` grouped by nodeId → find nodes whose last event is >14 days old. These are "forgotten" machines.

3. **Unmet Victory Conditions** — `db.victoryConditions.where('met').equals(false)` → cross-reference with `vcSnapshots` to see if the last snapshot is old (>7 days since last measurement = "unmeasured").

4. **Blocked Machines** — `db.nodes.where('statusId').equals('blocked')` → cross-reference with `statusChanges` to find when they were set to blocked. Calculate duration.

5. **Aging Captures** — `db.captures.where('processed').equals(false)` → captures sitting >2 days unprocessed are attention items.

### 5.2 — AttentionPanel Component (NEW section at top of Dashboard)

Renders above the machine cards grid:

```
┌────────────────────────────────────────────────────────┐
│  🔥 NEEDS ATTENTION (5)                    [Dismiss All Stale] │
│                                                        │
│  🔴 "DNS migration broken" — open 14 days on Infra    │ → click navigates
│  🟠 "Conversion rate" VC unmeasured 9 days on Sales   │ → click navigates
│  🟠 Content Machine — blocked 8 days                   │ → click navigates
│  🟡 3 unprocessed captures in inbox                    │ → click goes to /inbox
│  ⚪ Onboarding Machine — no activity 16 days           │ → click navigates
└────────────────────────────────────────────────────────┘
```

**Visual urgency via CSS (conditional classes):**
```css
.attention-item.severity-normal  { border-left: 3px solid #64748b; }
.attention-item.severity-amber   { border-left: 3px solid #f59e0b; background: rgba(245,158,11,0.05); }
.attention-item.severity-red     { border-left: 3px solid #ef4444; background: rgba(239,68,68,0.05); }
.attention-item.severity-critical {
  border-left: 3px solid #ef4444;
  background: rgba(239,68,68,0.08);
  animation: pulse-urgent 2s infinite;
}

@keyframes pulse-urgent {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
}
```

**Files to create:**
- `src/hooks/useDashboardScan.ts`
- `src/components/AttentionPanel.tsx`
- CSS added to `src/styles/dashboard.css`

**Files to modify:**
- `src/pages/Dashboard.tsx` — call `useDashboardScan()`, render `<AttentionPanel>` above grid

### 5.3 — Threshold Configuration

Store thresholds in a simple const (upgradeable to user-editable later):

```typescript
export const ATTENTION_THRESHOLDS = {
  problem: { amber: 3, red: 7, critical: 14 },   // days
  staleness: { amber: 7, red: 14, critical: 21 }, // days since last event
  capture: { amber: 1, red: 2, critical: 3 },     // days unprocessed
  blocked: { amber: 3, red: 7, critical: 14 },    // days blocked
};
```

---

## Execution Order & Dependencies

```
Phase 1 ──→ Phase 2 ──→ Phase 5
  (Capture)   (Inbox)     (Active Layer — needs captures for aging query)
                              ↑
Phase 3 ──────────────────────┤  (Progressive Disclosure — independent)
                              │
Phase 4 ──────────────────────┘  (Time Awareness — events table needed for staleness)
```

**Recommended order:** 1 → 2 → 4 → 3 → 5

- **Phase 1 first** because it's the smallest and immediately useful.
- **Phase 2 second** because it makes Phase 1 actually complete (capture without processing is a dead end).
- **Phase 4 third** because Phase 5 depends on the events table for staleness detection.
- **Phase 3 can be done anytime** — it's purely cosmetic, no data dependencies.
- **Phase 5 last** because it depends on both the captures table (Phase 1) and the events table (Phase 4).

---

## Session-by-Session Breakdown

| Session | Phase | What Gets Built | Est. Time |
|---|---|---|---|
| **Session 1** | Phase 1 | `Capture` type, `captures` table (v6), `CaptureBar.tsx` + CSS, keyboard shortcut, App.tsx integration, localStorage last-viewed tracking | 1 conversation |
| **Session 2** | Phase 2 | `Inbox.tsx` page + CSS, route in App.tsx, action handlers (problem/note/metric/dismiss), machine/node dropdowns, Dashboard inbox badge | 1-2 conversations |
| **Session 3** | Phase 4 | `MachineEvent` type, `events` table (v7), shadow-log all 10 write functions, duration utilities | 1 conversation |
| **Session 4** | Phase 3 | `Collapsible.tsx` component + CSS, sweep Dashboard cards, sweep Side Panel sections | 1-2 conversations |
| **Session 5** | Phase 5 | `useDashboardScan.ts` hook (5 queries), `AttentionPanel.tsx` + urgency CSS, Dashboard integration, threshold config | 2 conversations |

**Total: 6-8 conversations over ~1 focused week.**

---

## What NOT To Touch

- **No backend.** Everything stays in IndexedDB via Dexie.
- **No new npm packages.** `daysSince()` / `formatDaysSince()` already handle date math. No need for date-fns.
- **No new build config.** Vite setup is fine as-is.
- **No changes to React Flow.** The canvas, node types, and edge system are mature enough.
- **Don't refactor existing routing.** Just add `/inbox` route. Dashboard stays at `/`, Whiteboard stays at `/machine/:id`.

---

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| IndexedDB size with events table | Events are tiny rows (~200 bytes each). Even at 100 events/day for a year = 36,500 rows × 200B = ~7MB. IndexedDB handles this trivially. |
| Dashboard scan performance | All queries use indexed fields. Dexie with 5 parallel queries on <1000 rows completes in <50ms. No perceived lag. |
| Capture bar conflicting with other shortcuts | Use `⌘+.` which isn't used by React Flow or the existing `⌘+K` search or `⌘+J` status shortcuts. |
| DB migration breaking existing data | Dexie's versioning system handles additive migrations automatically. New tables don't affect old data. Tested pattern — we've gone from v1 to v5 already without issues. |
