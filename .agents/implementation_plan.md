# Machine Center — Implementation Plan

## Current State (what exists)
- Dashboard with machine cards (name, status, goal text, delete)
- Canvas with machine nodes (status, name, goal, bottleneck, "Enter" button)
- Side panel with 3 tabs: Design (goal, description) | Operations (status, bottleneck, problems) | Metrics (victory conditions)
- Animated flow edges with arrows
- ⌘J status shortcut, problem logging, inline editing
- Dexie.js local database

## Core Problems Identified

### P1: Nodes can't store data
- No notes, no documents, no checklists, no SOPs
- A machine is just status + state — no actual content
- You can't put a SOP in a sub-machine

### P2: Not everything is a "machine"
- **Machine** = has inputs/outputs, runs, has status, goal, victory conditions
- **SOP** = ordered checklist of steps (do this, then this, then this)
- **Tool** = software/equipment used (Lemlist, CRM, etc.)
- **Skill** = capability needed (copywriting, cold calling, etc.)
- All of these appear on the canvas but need different side panel views

### P3: Goal not settable from dashboard
- Dashboard shows "No goal set" but you have to drill in to set it
- Should be settable on creation or inline on the dashboard card

### P4: No roadmap / progress view
- The sub-machines ARE the roadmap for the parent machine
- But there's no way to see "3/5 sub-machines running" at a glance
- Dashboard card should show sub-machine progress

### P5: Can't add custom statuses
- Locked to 5 hardcoded statuses
- Need ability to add/edit/remove status types

---

## Proposed Model

### Node Types
Every node on the canvas has a `type` field:

```
type NodeType = 'machine' | 'sop' | 'tool' | 'skill' | 'note';
```

Each type shares the base fields (id, label, position, parentId) but the side panel
shows different content based on type:

| Type | Side Panel Shows |
|------|-----------------|
| **Machine** | Goal, Status, Bottleneck, Victory Conditions, Problems |
| **SOP** | Ordered checklist of steps (add/reorder/check off) |
| **Tool** | Name, link/URL, status (active/inactive), notes |
| **Skill** | Name, proficiency level, notes, resources |
| **Note** | Rich freeform text (markdown or plain text) |

### Content/Notes Field
EVERY node type gets a `notes` field — a freeform text area where you can
store anything. SOPs additionally get a `steps` checklist.

### Node Type Selector
When you add a node to the canvas, you pick the type. Or default to "machine"
and change later via the side panel. The node card on canvas shows a small
icon/badge indicating type.

---

## Implementation Phases

### Phase 1: Data & Goals (do now)
1. Add `type` field to MachineNode (default: 'machine')
2. Add `notes` field to MachineNode (freeform text)
3. Add goal input to machine creation modal on dashboard
4. Show sub-machine progress on dashboard card (e.g. "2/4 running")
5. Let user set goal inline on dashboard card

### Phase 2: Node Types (next)
1. Add SOP type with `steps` checklist (ordered, checkable)
2. Add Tool type with link/URL field
3. Add Skill type with proficiency level
4. Add Note type (just notes, no status/goal)
5. Update side panel to render different content per type
6. Update node cards on canvas to show type badge/icon
7. Add type selector to "Add Node" flow

### Phase 3: Custom Statuses & Polish
1. Settings page or modal to add/edit/remove status configurations
2. Dashboard card redesign showing progress + goal visually
3. Canvas improvements (double-click to rename, better edge routing)

### Phase 4: Brainstorming Features (if needed)
1. Sticky notes (lightweight note nodes)
2. Text labels on canvas
3. Grouping/sections
4. These may be covered by the Note node type from Phase 2

---

## Priority Order
1. Phase 1 — unblocks actual usage
2. Phase 2 — makes the model correct
3. Phase 3 — polish
4. Phase 4 — only if Phase 2 doesn't cover brainstorming needs
