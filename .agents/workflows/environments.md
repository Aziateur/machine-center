---
description: How to run stable + dev environments and promote safely
---

# Dev & Stable Environments

## Two Versions, Always Running

| | URL | Badge | Purpose |
|---|---|---|---|
| 🟢 **STABLE** | `http://localhost:4173` | None (clean) | Your real app. Bookmark this. Always works. |
| 🟠 **DEV** | `http://localhost:5173` | Orange **DEV** badge | For development. Can break. |

## How to Start

// turbo-all

### Start both servers (two terminal tabs):

```bash
# Tab 1 — Stable
npm run stable

# Tab 2 — Dev
npm run dev
```

## Push Dev → Production

When the user says **"push"**, **"promote"**, or **"push to prod"**:

### Step 1: Run the promote command

```bash
npm run promote
```

This does 3 things automatically:
1. ✅ Type-checks the entire codebase (`tsc --noEmit`)
2. ✅ Builds the production bundle (`vite build`)
3. ✅ Replaces `/stable` files **only if both pass**

If anything fails → **stable is untouched**. Zero risk.

### Step 2: Restart the stable server

```bash
# Kill and restart the stable server to pick up new files
kill $(lsof -ti:4173) 2>/dev/null; sleep 1 && npm run stable
```

### Step 3: Verify

Open `http://localhost:4173` and confirm the changes look correct.

## Data Safety

**Your data is NEVER harmed by a push.** Here's why:

- Data lives in **IndexedDB inside the browser**, tied to the port
- Port 4173 (stable) has its own database
- Port 5173 (dev) has its own database
- `npm run promote` only replaces **code files** (HTML, JS, CSS)
- It never reads, writes, or touches IndexedDB

### What gets replaced:
```
/stable/index.html        ← replaced
/stable/assets/*.js       ← replaced
/stable/assets/*.css      ← replaced
```

### What is NEVER touched:
```
Browser IndexedDB          ← safe, always
Your machines, nodes, etc  ← safe, always
```

## Rollback

If a promoted version has issues:

```bash
npm run rollback
```

Then restart stable:
```bash
kill $(lsof -ti:4173) 2>/dev/null; sleep 1 && npm run stable
```

This restores the previous stable build from the automatic backup.

## Summary

```
You say "push" → I run: npm run promote
                        → Type check passes? ✅
                        → Build passes? ✅
                        → Copy to /stable ✅
                        → Restart stable server ✅
                        → Your data? UNTOUCHED ✅
```
