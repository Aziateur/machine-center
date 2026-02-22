# The Machine Center — Complete Project Description

## What is this project?

The Machine Center is a **local-first, browser-based visual management tool** for designing, operating, and evolving "machines" — the user's mental model for repeatable business processes. Think of it as a cross between a process diagram tool (like Miro) and an operational dashboard (like a simplified OpsGenie), but specifically designed for one person managing multiple interconnected business systems.

The core metaphor is: **every business process is a "machine"** with inputs, outputs, a goal, and a status. Machines are **fractal** — a machine can contain sub-machines. For example, a "Business" machine might contain "Lead Generation", "Sales", and "Fulfillment" sub-machines. "Lead Generation" might in turn contain "Cold Outreach", "Content Funnel", and "Paid Ads".

The app is 100% local — all data is stored in the browser's IndexedDB via Dexie.js. There is no backend, no API, no auth. It runs as a Vite dev server at `localhost:5173`.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | React | 19.2 |
| Build tool | Vite | 7.3 |
| Language | TypeScript | 5.9 |
| Routing | react-router-dom | 7.13 |
| Canvas/Diagram | @xyflow/react (React Flow) | 12.10 |
| Local DB | Dexie.js (IndexedDB wrapper) | 4.3 |
| Icons | lucide-react | 0.575 |
| IDs | uuid | 13.0 |
| Styling | Vanilla CSS (custom design system) | — |
| Font | Inter (Google Fonts) | — |

### How to run
```bash
cd "/Users/alielhallaoui/Desktop/the machine center"
npm install
npm run dev
# Opens at http://localhost:5173
```

---

## Architecture Overview

```
src/
├── main.tsx              # React entry point (StrictMode + createRoot)
├── App.tsx               # Router: "/" → Dashboard, "/machine/:machineId" → Whiteboard
├── types/index.ts        # ALL TypeScript interfaces and type definitions
├── db/index.ts           # Dexie.js database schema (v4) + migrations + seeding
├── components/
│   ├── ErrorBoundary.tsx  # React error boundary (catches crashes, shows reset button)
│   └── nodes/
│       └── FlowNodes.tsx  # React Flow custom node component (renders all 5 node types)
├── pages/
│   ├── Dashboard.tsx      # Home page — grid of root-level machine cards
│   └── Whiteboard.tsx     # Main canvas page — React Flow + side panel (900+ lines)
└── styles/
    ├── index.css          # Global design system (CSS variables, buttons, inputs, modals)
    ├── dashboard.css      # Dashboard-specific styles
    └── whiteboard.css     # Whiteboard + side panel styles (~1200 lines)
```

---

## Data Model (src/types/index.ts)

### Node Types
There are **5 node types** that can exist on any canvas:

```typescript
type NodeType = 'machine' | 'sop' | 'tool' | 'skill' | 'note';
```

Each type has a config (label, icon, color) defined in `NODE_TYPE_CONFIG`.

| Type | Purpose | Icon | Color | Unique fields used |
|---|---|---|---|---|
| `machine` | A repeatable process with inputs/outputs | ⚙ | #6366f1 (indigo) | goal, bottleneck, statusId, hasChildren |
| `sop` | Standard Operating Procedure — ordered checklist | 📋 | #f59e0b (amber) | steps[] (SopStep array) |
| `tool` | Software or equipment used in a process | 🔧 | #3b82f6 (blue) | toolUrl, statusId |
| `skill` | A capability or competency needed | ⭐ | #8b5cf6 (purple) | proficiency (ProficiencyLevel) |
| `note` | Freeform text block for brainstorming/context | 📝 | #64748b (slate) | notes |

### MachineNode (the universal node interface)
**All 5 types share the same `MachineNode` interface.** The `type` field determines which fields are semantically meaningful and which side panel tabs appear. This is a deliberate design choice — keeps the DB schema simple and allows nodes to change type.

```typescript
interface MachineNode {
  id: string;
  parentId: string;        // '' = root-level (shows on dashboard). Otherwise = parent machine's id
  type: NodeType;
  label: string;
  description: string;
  statusId: string;        // references StatusConfig.id
  position: { x: number; y: number };  // canvas coordinates
  goal: string;            // free text
  bottleneck: string;      // free text
  notes: string;           // freeform text, available on ALL types
  steps: SopStep[];        // SOP checklist items
  toolUrl: string;         // URL for tool nodes
  proficiency: ProficiencyLevel | null;  // 'beginner' | 'intermediate' | 'advanced' | 'expert'
  hasChildren: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### SopStep
```typescript
interface SopStep {
  id: string;
  text: string;
  done: boolean;
  order: number;
}
```
Stored as a JSON array inside the `steps` field of `MachineNode`. Not a separate DB table.

### StatusConfig
5 default statuses, stored in the `statuses` DB table:
```
running    → 🟢 green   (#22c55e)
under      → 🟡 amber   (#f59e0b)   "Under Construction"
blocked    → 🔴 red     (#ef4444)
not-built  → ⚪ gray    (#6b7280)
optimizing → 🟣 purple  (#8b5cf6)
```

### VictoryCondition
Custom key-value metrics per machine node:
```typescript
interface VictoryCondition {
  id: string;
  machineNodeId: string;
  label: string;    // "Cycle speed", "Cost per lead"
  target: string;   // "< 4 days", "$5"
  current: string;  // "6 days", "$8"
  met: boolean;
  order: number;
}
```

### Problem
Issues logged against a machine:
```typescript
interface Problem {
  id: string;
  machineNodeId: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'diagnosing' | 'planned' | 'fixing' | 'resolved';
  diagnosis: string;
  plan: string;
  createdAt: Date;
  resolvedAt: Date | null;
}
```

### MachineEdge
Connections between nodes on the same canvas:
```typescript
interface MachineEdge {
  id: string;
  parentId: string;   // which canvas (parent machine) this edge belongs to
  source: string;     // source node id
  target: string;     // target node id
  label?: string;
}
```

### Other types (Lever, Principle)
These exist in the DB schema but are **not currently used in the UI**:
- `Lever` — adjustable parameters on a machine
- `Principle` — text rules for how a machine should operate

---

## Database (src/db/index.ts)

Uses **Dexie.js** wrapping IndexedDB. Database name: `MachineCenter`.

### Current version: 4
Schema with indexed fields:
```
nodes:              id, parentId, type, statusId, createdAt
edges:              id, parentId, source, target
statuses:           id, order
problems:           id, machineNodeId, status, severity, createdAt
levers:             id, machineNodeId
principles:         id, machineNodeId
victoryConditions:  id, machineNodeId, order
```

### Migration chain: v2 → v3 → v4
- **v2**: Original schema (nodes, edges, statuses, problems, levers, principles)
- **v3**: Added `victoryConditions` table
- **v4**: Added `type`, `notes`, `steps`, `toolUrl`, `proficiency`, `bottleneck` fields to nodes. Upgrade function sets defaults for existing data.

### Seeding
On first run (`populate` event) and on `ready` if `statuses` table is empty, the 5 default statuses are inserted.

---

## Pages

### Dashboard (`/`)
**File**: `src/pages/Dashboard.tsx` (241 lines)

A grid of cards showing all root-level machines (nodes with `parentId === ''`).

**Features:**
- **Creation modal**: "New Machine" button opens a modal with fields for machine name AND goal (both set at creation time)
- **Machine cards** show: status badge, name, goal (with 🎯 emoji), date, problem count
- **Inline goal editing**: Click the goal text on a card to edit it without drilling in. If no goal is set, shows an amber "Click to set goal" prompt
- **Sub-machine progress bar**: Each card shows a green progress bar indicating how many sub-machines are running (e.g., "2/4 running · 1 blocked")
- **Delete**: × button on card, with recursive deletion of all children, edges, problems
- **Click card** → navigates to `/machine/:machineId` (Whiteboard page)

### Whiteboard (`/machine/:machineId`)
**File**: `src/pages/Whiteboard.tsx` (1016 lines)

The main workspace. A React Flow canvas with a right-side detail panel.

**URL structure**: `/machine/:machineId?parent=<parentId>`
- `machineId` is the root machine from the dashboard
- `parent` query param controls which level of the hierarchy is shown on canvas
- When you click "Enter →" on a machine node, it sets `parent` to that node's id

**Key components in this file:**

1. **WhiteboardInner** — the main component (wrapped in `ReactFlowProvider`)
   - Loads nodes/edges/problems/victoryConditions from Dexie
   - Manages selection, context menu, breadcrumbs
   - Keyboard shortcut: `⌘J` opens status shortcut overlay

2. **AddNodeMenu** — modal overlay showing all 5 node types (Machine, SOP, Tool, Skill, Note). Click one to add it to canvas.

3. **SidePanel** — right-side detail panel, tabs change based on selected node's type:
   - **Machine**: Design (goal, description) | Ops (status grid, bottleneck, problems) | Metrics (victory conditions) | Notes
   - **SOP**: Steps (checklist) | Notes
   - **Tool**: Details (URL, status, description) | Notes
   - **Skill**: Details (proficiency level selector) | Notes
   - **Note**: Content (just the notes textarea)

4. **Sub-panels** (separate functions):
   - `MachineDesignPanel` — goal + description editing
   - `MachineOpsPanel` — status buttons, bottleneck, problem list
   - `MetricsPanel` + `VCRow` — victory conditions CRUD
   - `SopPanel` + `SopStepRow` — checklist with add/check/delete/edit
   - `ToolPanel` — URL field, status grid, description
   - `SkillPanel` — proficiency level selector (Beginner → Expert)
   - `NotesPanel` — universal freeform textarea
   - `ProblemCard` — expandable problem with title, status dropdown, diagnosis, plan

5. **ShortcutOverlay** — keyboard-driven status picker (press 1-5 to set status)

**Canvas features:**
- Dot grid background
- Smooth-step animated edges with arrow markers
- MiniMap (bottom right, color-coded by status)
- Controls (zoom, fit view)
- Drag nodes to reposition (auto-saved)
- Connect nodes by dragging from handles (left input, right output)
- Context menu (right-click) with Edit and Delete
- Breadcrumb navigation at top (Machines › Lead Generation › Cold Outreach)
- Back arrow button returns to parent level

---

## Components

### FlowNodes (`src/components/nodes/FlowNodes.tsx`, 141 lines)

A single React Flow custom node component (`MachineNodeComponent`) registered as type `machine`. Despite the registration name, it renders ALL 5 node types — the visual appearance changes based on `data.nodeType`:

- **Header**: Type badge (e.g., "⚙ MACHINE", "📋 SOP") with color, plus problem count + status dot
- **Body** (type-specific):
  - Machine: goal text or "No goal set" warning, bottleneck if present
  - SOP: step progress (e.g., "1/3 steps" with green progress bar)
  - Tool: URL hostname + status
  - Skill: proficiency level text
  - Note: first 80 chars of notes as preview
- **Enter button**: Only on machine nodes — navigates into sub-machine canvas
- **Handles**: Left (input target) and Right (output source)
- **Selection state**: Border highlight + glow shadow in type-specific color

**`MachineNodeData` interface** is the data shape passed to each node. It includes all type-specific fields plus callbacks (`onDrillDown`, `onSelect`).

### ErrorBoundary (`src/components/ErrorBoundary.tsx`, 70 lines)
Standard React error boundary. Shows error message + stack trace + "Go Back to Dashboard" button.

---

## Styling

### Design System (`src/styles/index.css`, 292 lines)
- **Dark theme** throughout — `--bg-app: #0f0f14`
- CSS custom properties for all colors, spacing, shadows, radii
- Reusable classes: `.btn` (primary/secondary/ghost/danger/sm/icon), `.input`, `.textarea`, `.modal`, `.form-group`, `.form-label`, `.status-badge`
- Google Fonts: Inter (400-800 weights)
- Custom scrollbar styling
- Keyframe animations: fadeIn, slideUp, pulse

### Dashboard styles (`src/styles/dashboard.css`, ~250 lines)
- Machine card grid with hover effects
- Status color accent on left border
- Progress bar for sub-machine tracking
- Goal editing input
- Creation modal form

### Whiteboard styles (`src/styles/whiteboard.css`, ~1200 lines)
- Canvas layout (full-height flex)
- Breadcrumb navigation
- Side panel (fixed right column, ~350px)
- Tab system
- All node-on-canvas styles (machine-node class family)
- Type-specific node border colors and badges
- Status grid buttons
- Problem cards with severity accents
- Victory condition rows
- SOP checklist (step rows, progress bar, check buttons)
- Skill level selector buttons
- Notes textarea
- Shortcut overlay (centered modal)
- Context menu
- Toolbar (top-left floating add button)
- Empty canvas state

---

## Hierarchical Navigation Model

The app has a **fractal hierarchy** — machines contain other machines (and SOPs, tools, etc.):

```
Dashboard (/)
└── Business (root machine, parentId = '')
    ├── Lead Generation (parentId = business.id)
    │   ├── Cold Outreach SOP (sop, parentId = leadgen.id)
    │   ├── Lemlist (tool, parentId = leadgen.id)
    │   └── Email Copywriting (skill, parentId = leadgen.id)
    ├── Sales (parentId = business.id)
    └── Fulfillment (parentId = business.id)
```

**Navigation flow:**
1. Dashboard shows root machines (parentId = '')
2. Click card → `/machine/:machineId` with parent = machineId
3. Canvas shows nodes where parentId = current parent
4. Click "Enter →" on a machine node → updates ?parent query param
5. Breadcrumbs track the path and allow jumping back

**Data is scoped by parent:**
- Nodes: `db.nodes.where('parentId').equals(parentId)`
- Edges: `db.edges.where('parentId').equals(parentId)`

---

## Key Behavioral Details

1. **All editing is inline** — click text to edit, press Enter or click away to save. No separate "edit mode".

2. **Node creation flow**: Click "+" toolbar button → type selector modal → pick type → node appears at center of canvas with default name ("New Machine", "New SOP", etc.) → click to select → edit in side panel.

3. **Position auto-save**: When you stop dragging a node, its position is immediately written to DB (`onNodeDragStop`).

4. **Problem status flow**: open → diagnosing (when you add a diagnosis) → planned (when you add a plan) → fixing → resolved. But users can set any status at any time via the dropdown.

5. **Victory conditions** are per-machine, key-value pairs with a pass/fail toggle. They're meant for custom quality metrics ("cycle speed < 4 days", "cost per lead < $5").

6. **SOP steps** are stored as a JSON array on the node itself (not a separate table). They have: id, text, done, order.

7. **Status shortcut**: Select a node → press ⌘J → press 1-5 to set status instantly.

8. **Delete is recursive**: Deleting a machine node also deletes all its children, their edges, and their problems.

9. **The "Enter" button is only on machine-type nodes** — only machines can have sub-canvases.

---

## What's NOT Built Yet (known gaps)

1. **Custom statuses** — users can't add/edit/remove status types yet. The 5 defaults are hardcoded in the seed data.
2. **Levers and Principles** — tables exist in DB but no UI is wired up.
3. **Search** — no way to search across all machines/nodes.
4. **Export/Import** — no way to backup or share data.
5. **Undo/Redo** — no history management.
6. **Edge labels** — the `label` field on edges exists but can't be set in UI.
7. **Node reordering/alignment** — no snap-to-grid alignment tools.
8. **Dashboard sorting/filtering** — machines appear in creation order only.
9. **The `SopStep.order` field** is set but steps aren't drag-reorderable in UI.
10. **Production build** — currently only runs as dev server. No deployment config.

---

## File-by-File Summary

| File | Lines | Purpose |
|---|---|---|
| `src/main.tsx` | 10 | React entry point |
| `src/App.tsx` | 21 | Router with 2 routes, ErrorBoundary wrapper |
| `src/types/index.ts` | 157 | All interfaces, types, constants, defaults |
| `src/db/index.ts` | 77 | Dexie DB setup, schema versions, migrations, seeding |
| `src/components/ErrorBoundary.tsx` | 70 | Error boundary component |
| `src/components/nodes/FlowNodes.tsx` | 141 | React Flow custom node (renders all 5 types) |
| `src/pages/Dashboard.tsx` | 241 | Dashboard page (machine cards, creation, goals, progress) |
| `src/pages/Whiteboard.tsx` | 1016 | Main canvas page (React Flow + side panel + all sub-panels) |
| `src/styles/index.css` | 292 | Global design system |
| `src/styles/dashboard.css` | ~250 | Dashboard styles |
| `src/styles/whiteboard.css` | ~1200 | Whiteboard + panel styles |
| `index.html` | 14 | HTML entry point |
| `vite.config.ts` | 8 | Vite config (just react plugin) |
| `package.json` | 40 | Dependencies and scripts |
