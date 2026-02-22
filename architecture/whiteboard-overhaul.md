# 🏗️ Whiteboard Overhaul — Complete Plan

> Goal: Make the whiteboard feel like Miro — intuitive, powerful, fast.
> Status: PLANNING (not started)

---

## Current State (what we have)

- ✅ Nodes (machine, sop, tool, skill, note) with custom styling
- ✅ Edges with labels ("Feeds into", etc.) and click-to-edit
- ✅ Snap to grid (20px)
- ✅ Minimap
- ✅ Zoom controls
- ✅ 4-side connection handles
- ✅ Context menu (right-click → edit/delete)
- ✅ Drill-down into child machines
- ✅ Side panel for node editing
- ✅ Background dots

## What's Missing (what Miro has that we don't)

### 🔴 Critical (makes the whiteboard feel broken without these)

1. **Rectangle drag selection** — click empty space + drag = selection box
2. **Multi-select** — Shift+click to add/remove from selection
3. **Delete selected** — Backspace/Delete key removes selected nodes
4. **Pan mode toggle** — Space+drag to pan (currently you can only pan, never select)
5. **Select All** — ⌘A to select everything

### 🟡 Important (significantly improves usability)

6. **Copy/Paste nodes** — ⌘C/⌘V to duplicate nodes (with new IDs)
7. **Duplicate node** — ⌘D or Alt+drag to create a copy
8. **Undo/Redo** — ⌘Z / ⌘⇧Z with history stack
9. **Double-click to rename** — click a node label to edit it inline
10. **Keyboard shortcuts overlay** — press `?` to see all shortcuts
11. **Better toolbar** — icons for: Select, Pan, Add Node, Zoom Fit, Undo, Redo

### 🟢 Nice-to-have (makes it feel premium)

12. **Alignment guides** — snap lines when dragging near other nodes (like Figma)
13. **Auto-layout** — button to auto-arrange nodes in a clean layout
14. **Zoom to selection** — ⌘+2 to zoom into selected nodes
15. **Lock nodes** — prevent accidental moves on important nodes
16. **Group/Frame nodes** — create a visual group around related nodes
17. **Edge path style toggle** — straight, smoothstep, bezier
18. **Bulk status change** — select multiple nodes → change status for all
19. **Quick-add on edge** — click "+" on an edge to insert a node between two
20. **Search on canvas** — ⌘F to find and zoom to a specific node

---

## Implementation Waves

### Wave 1: Selection & Interaction (ReactFlow props — low effort)

These are just props on `<ReactFlow>`, almost zero custom code:

```tsx
<ReactFlow
    selectionOnDrag           // rectangle drag selection
    selectionMode={SelectionMode.Partial}  // select partially covered nodes
    panOnDrag={[1, 2]}        // middle-click or right-click to pan
    panOnScroll               // scroll to pan
    zoomOnScroll              // ctrl+scroll to zoom
    selectionKeyCode="Shift"  // Shift+drag for selection
    multiSelectionKeyCode="Shift"  // Shift+click to add to selection
    deleteKeyCode="Backspace" // delete selected nodes
    selectNodesOnDrag={false} // don't auto-select on drag
/>
```

CSS for selection box:
```css
.react-flow__selection {
    background: rgba(99, 102, 241, 0.08);
    border: 1.5px dashed #6366f1;
    border-radius: 4px;
}
```

### Wave 2: Keyboard Shortcuts (custom hook — medium effort)

Create `useWhiteboardShortcuts()` hook:

| Shortcut | Action |
|---|---|
| `⌘A` | Select all nodes |
| `⌘C` | Copy selected nodes/edges to clipboard |
| `⌘V` | Paste nodes (offset +20px, new IDs) |
| `⌘D` | Duplicate selected (in-place) |
| `⌘Z` | Undo |
| `⌘⇧Z` | Redo |
| `Delete` / `Backspace` | Delete selected |
| `Space` (hold) | Temporary pan mode |
| `Escape` | Deselect all |
| `?` | Toggle shortcuts overlay |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` | Zoom to fit |

### Wave 3: Undo/Redo (history stack — medium effort)

Create `useUndoRedo()` hook:
- `pastStates: FlowState[]` (max 50)
- `futureStates: FlowState[]`
- On any change: push current state to `past`, clear `future`
- On undo: pop from `past`, push current to `future`
- On redo: pop from `future`, push current to `past`
- Debounce drag moves (group into single undo step)

### Wave 4: Toolbar Upgrade (UI — medium effort)

Replace the current single "+" button with a full toolbar:

```
┌──────────────────────────────┐
│ ↖ Select  |  ✋ Pan  |  + Add │
│ ↩ Undo  |  ↪ Redo            │
│ 📐 Fit  |  🔍 Search         │
└──────────────────────────────┘
```

- Active tool highlighted
- Tooltip on hover showing keyboard shortcut
- Responsive — collapses on small screens

### Wave 5: Double-click Inline Rename (custom — medium effort)

- Double-click a node label → turns into `<input>`
- Press Enter or click away → saves
- Press Escape → cancels
- Works on all node types

### Wave 6: Copy/Paste (custom — medium effort)

- ⌘C: serialize selected nodes + edges to JSON
- ⌘V: deserialize, assign new UUIDs, offset positions
- Preserve edges between copied nodes
- Also save to OS clipboard (so you can paste between browser tabs)

### Wave 7: Premium Polish (nice-to-haves)

- Alignment guides (horizontal/vertical snap lines)
- Auto-layout via dagre/elkjs
- Shortcuts overlay modal
- Bulk status change
- Lock/unlock nodes
- Search + zoom-to on canvas

---

## Files to Modify

| File | Changes |
|---|---|
| `src/pages/Whiteboard.tsx` | ReactFlow props, keyboard handlers, toolbar |
| `src/styles/whiteboard.css` | Selection box, toolbar, inline edit styles |
| `src/hooks/useUndoRedo.ts` | NEW — history stack hook |
| `src/hooks/useWhiteboardShortcuts.ts` | NEW — keyboard shortcut handler |
| `src/components/nodes/FlowNodes.tsx` | Double-click rename support |
| `src/components/WhiteboardToolbar.tsx` | NEW — upgraded toolbar component |
| `src/components/ShortcutsOverlay.tsx` | NEW — keyboard shortcuts help modal |

---

## Success Criteria

After this overhaul, a user should be able to:
1. Rectangle-drag to select multiple nodes
2. Move them as a group
3. Delete them with Backspace
4. Copy/paste them
5. Undo any mistake
6. Never feel "stuck" or "limited"
7. Learn shortcuts via the ? overlay
8. Feel like they're using Miro, not a prototype

---

*Created: 2026-02-22T15:20:00+01:00*
