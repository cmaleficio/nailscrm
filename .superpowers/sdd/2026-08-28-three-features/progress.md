# SDD ledger — plan: docs/superpowers/plans/2026-08-28-three-features.md

## Preflight scan

| Task pair | Shared file/interface | Status |
|---|---|---|
| 1.2 / 1.3 | Different files (payments/route.ts vs supplier-payments/route.ts) | No conflict |
| 2.1 / 3.1 | src/db/schema.ts (line 115 vs line 243) | Different lines, no conflict |
| 2.2 / 2.3 | src/app/api/purchases/route.ts — 2.3 extends GET+new POST; 2.2 reads from it | Read/write ok, no conflict |
| 2.3 / 2.4-2.7 | AddServiceDialog.tsx — 2.3 creates POST API; 2.4-2.7 mount the dialog | Producer/consumer ok |
| 3.2 / 3.3 | src/lib/inventory.ts — 3.2 exports applyCostAdjustment; 3.3 calls it | Producer/consumer ok |
| 3.3 / 3.5 | EditCostDialog.tsx — 3.3 adds avgCost to PATCH; 3.5 creates dialog that sends it | Producer/consumer ok |
| 2.2 / 2.3 | clients/[id]/route.ts — 2.2 adds isNull/or imports; 2.3 inserts orphan purchase | Must not regress |

**Rulings:**
- Ruling: Task 2.2 adds `isNull, or` to drizzle imports in `clients/[id]/route.ts` — no conflict with other tasks.
- Ruling: Task 3.3 mentions modifying the return of PATCH to include updated avgCost — simplified to inline calculation (since applyCostAdjustment already updated DB). This is an implementation detail noted for reviewer.
- Ruling: DB migration Task 1.1 (0015_rare_tinkerer.sql) already staged from prior subagent run. Task 1.1 SDD execution skipped (already done).
- Ruling: Task 1.2 — current guard `typeof reference !== "string" || !reference.trim()` rejects non-strings AND empty strings. New guard should be `!userId || typeof userId !== "string" || !userId.trim()` (reference is no longer checked here). The subagent must understand this is the ONLY change on line 49.
- Ruling: Batch Tasks 1.2-1.6 (small same-shape edits, all in Feature 1) into one dispatch per SKILL.md §"Batch small same-shape work".

## Task progress

- Task 1.1: complete (schema.ts lines 168 & 306 modified; migration 0015_rare_tinkerer.sql generated)
- Task 1.2-1.6: complete (commits 3f0b2b5..ab2d5c0, review clean — strictness tightening of userId noted as minor, out of scope)
- Task 2.1: pending
- Task 2.2: pending
- Task 2.3: pending
- Task 2.4: pending
- Task 2.5: pending
- Task 2.6: pending
- Task 2.7: pending
- Task 3.1: pending
- Task 3.2: pending
- Task 3.3: pending
- Task 3.4: pending
- Task 3.5: pending
- Task 4.1: pending
