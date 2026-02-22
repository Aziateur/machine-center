# Architecture: Environments

> How dev, stable, and production environments work.

---

## Environments

| Environment | Port | Purpose | Updates |
|---|---|---|---|
| 🟠 **Dev** | `localhost:5173` | Active development, hot reload | Every file save |
| 🟢 **Stable** | `localhost:4173` | Reliable production build | Only on `npm run promote` |
| 🌐 **Vercel** | `*.vercel.app` | Cloud hosting (planned) | On push to main branch |

## Visual Identification

- **Dev** → Orange pulsing `DEV` badge (top-left corner)
- **Stable** → Clean interface, no badge
- Controlled by `import.meta.env.DEV` (Vite strips this in production builds)

## Promote Flow

```
npm run promote
    │
    ├── Step 0: Check data backups (scripts/backup-data.mjs)
    ├── Step 1: Type-check (tsc --noEmit)
    │   └── FAIL? → Abort. Stable untouched.
    ├── Step 2: Build (vite build)
    │   └── FAIL? → Abort. Stable untouched.
    └── Step 3: Atomic replace
        ├── Backup current /stable → /.stable-backup
        └── Copy /dist → /stable
```

## Rollback

```
npm run rollback
    └── Move /.stable-backup → /stable
```

## Data Safety

- **Code** lives in `/stable` (static files) → replaced on promote
- **Data** lives in Supabase (cloud PostgreSQL) → NEVER touched by promote
- Both environments share the same Supabase database

## Files

- `scripts/promote.sh` — Promote pipeline
- `scripts/serve-stable.sh` — Static file server on port 4173
- `scripts/rollback.sh` — Revert to previous stable
- `scripts/backup-data.mjs` — Check backup freshness
