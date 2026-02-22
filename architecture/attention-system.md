# Architecture: Attention System

> How the dashboard scan identifies items needing attention.

---

## Overview

The Attention System runs on every dashboard load. It scans all data and surfaces items that need user action, ranked by severity.

## Scan Logic (`src/hooks/useDashboardScan.ts`)

### 1. Stale Problems
- Scans all problems where `status !== 'resolved'`
- Calculates age from `createdAt`
- Thresholds: amber 3d, red 7d, critical 14d

### 2. Blocked Machines
- Finds all nodes where `statusId === 'blocked'`
- Looks up last `status_changes` entry to determine blocked duration
- Thresholds: amber 3d, red 7d, critical 14d

### 3. Unmet Victory Conditions
- Finds all VCs where `met === false`
- Uses parent node's `updatedAt` to determine staleness
- Thresholds: amber 7d, red 14d, critical 21d

### 4. Stale Nodes
- Root machines with no recent activity
- Skips blocked machines (already covered above)
- Thresholds: amber 7d, red 14d, critical 21d

### 5. Aging Captures
- Unprocessed captures in the inbox
- Oldest age determines severity
- Thresholds: amber 1d, red 2d, critical 3d

## Sorting

Results sorted by: severity (critical first) → age (oldest first)

## UI: AttentionPanel (`src/components/AttentionPanel.tsx`)

- Shows up to 8 items
- Each item is clickable → navigates to the relevant machine
- "Dismiss All" button hides the panel until page reload
- Severity icons: 🟡 amber, 🔴 red, 🔥 critical

## Thresholds (defined in `src/types/index.ts`)

```typescript
ATTENTION_THRESHOLDS = {
    problem: { amber: 3, red: 7, critical: 14 },
    staleness: { amber: 7, red: 14, critical: 21 },
    capture: { amber: 1, red: 2, critical: 3 },
    blocked: { amber: 3, red: 7, critical: 14 },
};
```
