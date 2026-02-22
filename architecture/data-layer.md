# Architecture: Data Layer

> How data reads and writes flow through the system.

---

## Overview

```
React Component → db.tableName.method() → SupabaseTable → Supabase REST API → PostgreSQL
```

## Read Flow

1. Component calls `db.nodes.toArray()` or `db.nodes.where('parentId').equals(machineId).toArray()`
2. `SupabaseTable` converts camelCase field names → snake_case via field map
3. Supabase client sends GET request to the REST API
4. Response rows are converted snake_case → camelCase
5. Typed array is returned to the component

## Write Flow

1. Component calls `db.nodes.add(node)` or `db.nodes.update(id, updates)`
2. `SupabaseTable.toDbRow()` converts the object to snake_case
3. Field map overrides handle multi-word fields (e.g., `machineNodeId` → `machine_node_id`)
4. Supabase client sends INSERT/UPDATE/UPSERT to REST API
5. Component updates local React state for instant UI feedback

## Field Mapping

Auto-conversion: `statusId` → `status_id` (regex: `/([A-Z])/g` → `_$1`)

Explicit overrides (for compound fields):
```typescript
NODE_FIELDS = {
    parentId: 'parent_id',
    statusId: 'status_id',
    toolUrl: 'tool_url',
    hasChildren: 'has_children',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
};
```

## Edge Cases

- **Dates:** PostgreSQL returns ISO strings; components must handle both `Date` objects and `string` timestamps
- **JSONB fields:** `position` and `steps` are stored as JSONB in Postgres, returned as parsed objects
- **Null vs undefined:** Supabase returns `null` for missing values; TypeScript interfaces may expect `undefined`
- **No transactions:** Supabase REST API doesn't support multi-table transactions. Node deletion uses sequential awaits (safe for single-user)

## File: `src/db/index.ts`
