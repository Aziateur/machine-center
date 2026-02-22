# Machine Center — Task Plan

> Phases, goals, and checklists. Updated as work progresses.

---

## Current Phase: **Phase 2 — Link (Connectivity)**

We are mid-migration from IndexedDB → Supabase. The code layer is rewritten. The SQL schema needs to be executed in Supabase.

---

## Phase 1: Blueprint ✅ COMPLETE

- [x] North Star defined → visual OS for personal business machines
- [x] Data schema defined in `gemini.md`
- [x] Core types defined in `src/types/index.ts`
- [x] UI architecture decided → React + Vite + ReactFlow
- [x] Progressive disclosure via Collapsible component
- [x] Event logging integrated across key actions
- [x] Attention system (dashboard scan + attention panel)
- [x] Dev/Stable dual-environment setup

## Phase 2: Link 🔄 IN PROGRESS

- [x] Supabase project created (`fsogymxttriasxuujlzf`)
- [x] `.env` configured with URL + anon key
- [x] `@supabase/supabase-js` installed
- [x] SQL schema written (`supabase/schema.sql`)
- [x] DB layer rewritten (`src/db/index.ts`) — Dexie API surface preserved
- [x] TypeScript compiles with zero errors
- [x] Production build passes
- [ ] **⏳ BLOCKED: Run SQL schema in Supabase SQL Editor**
- [ ] Verify app connects to Supabase (test read/write)
- [ ] Migrate existing IndexedDB data to Supabase
- [ ] Confirm both dev + stable share same cloud data

## Phase 3: Architect 📋 PLANNED

- [ ] Create architecture SOPs for key systems
  - [ ] `architecture/data-layer.md` — How DB reads/writes work
  - [ ] `architecture/whiteboard.md` — ReactFlow node/edge lifecycle
  - [ ] `architecture/attention-system.md` — Dashboard scan logic
  - [ ] `architecture/environments.md` — Dev/stable/promote flow
- [ ] Self-annealing: document all error patterns + fixes

## Phase 4: Stylize 📋 PLANNED

- [ ] Audit all UI for consistency
- [ ] Verify responsive behavior
- [ ] Polish animations and transitions
- [ ] Add loading states for Supabase async calls (important!)
- [ ] Present to user for feedback

## Phase 5: Trigger 📋 PLANNED

- [ ] Deploy to Vercel (production hosting)
- [ ] Configure Vercel env variables
- [ ] Set up custom domain (optional)
- [ ] Document maintenance procedures in `gemini.md`
- [ ] Final user sign-off

---

*Last updated: 2026-02-22T14:28:00+01:00*
