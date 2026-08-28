# Task Brief — Feature 1 batch: Tasks 1.2–1.6

> Tasks 1.1 (DB schema) already done by prior subagent. NO migration files. Apply code changes directly.

## Task 1.2: POST /api/payments — remove reference guard

**Files:**
- Modify: `src/app/api/payments/route.ts:49,111`

**Steps:**
1. Read `src/app/api/payments/route.ts` (lines 40–55 and 100–120)
2. Line 49: change the guard from:
   ```ts
   if (!userId || typeof reference !== "string" || !reference.trim()) {
     return NextResponse.json({ error: "userId y reference son requeridos" }, { status: 400 });
   }
   ```
   To:
   ```ts
   if (!userId || typeof userId !== "string" || !userId.trim()) {
     return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
   }
   ```
   — `userId` remains required; `reference` is removed from the guard entirely.
3. Line 111: change `reference: reference.trim(),` to:
   ```ts
   reference: typeof reference === "string" && reference.trim() ? reference.trim() : null,
   ```
4. Run `npx tsc --noEmit` — must pass with 0 errors.

---

## Task 1.3: POST /api/supplier-payments — remove reference guard (keep photoUrl guard)

**Files:**
- Modify: `src/app/api/supplier-payments/route.ts:65-66,81`

**Steps:**
1. Read `src/app/api/supplier-payments/route.ts` (lines 60–90)
2. Lines 65–66: DELETE the entire block:
   ```ts
   if (typeof body.reference !== "string" || !body.reference.trim()) {
     return NextResponse.json({ error: "La referencia es requerida" }, { status: 400 });
   }
   ```
3. Line 81: change `reference: body.reference.trim(),` to:
   ```ts
   reference: typeof body.reference === "string" && body.reference.trim() ? body.reference.trim() : null,
   ```
4. Verify lines 68–70 (`photoUrl` guard) remain untouched.
5. Run `npx tsc --noEmit` — must pass.

---

## Task 1.4: RegisterPaymentDialog — remove * from label

**Files:**
- Modify: `src/components/RegisterPaymentDialog.tsx`

**Steps:**
1. Read the file and find the label `"Número de referencia *"` (around line 166–172)
2. Change it to `"Número de referencia"` (remove the asterisk only; keep the input unchanged)
3. Run `npx tsc --noEmit` — must pass.

---

## Task 1.5: SupplierPaymentDialog — remove client validation + update placeholder

**Files:**
- Modify: `src/components/SupplierPaymentDialog.tsx`

**Steps:**
1. Read the file (focus on lines ~70–77 and the placeholder text ~179)
2. DELETE the client-side validation block (around lines 70–73):
   ```ts
   if (!reference.trim()) {
     setError("La referencia es requerida");
     return;
   }
   ```
3. Change the placeholder text of the reference input from `"Referencia (ej: TRF-0001)"` to `"Referencia (opcional)"`
4. Verify the `photoUrl` client-side validation (around lines 74–77) is untouched.
5. Run `npx tsc --noEmit` — must pass.

---

## Task 1.6: CompleteAppointmentDialog — remove * from label

**Files:**
- Modify: `src/components/CompleteAppointmentDialog.tsx`

**Steps:**
1. Read the file and find `"Número de referencia *"` (around line 322–330)
2. Change it to `"Número de referencia"` (remove the asterisk only)
3. Run `npx tsc --noEmit` — must pass.

---

## Report contract

Write full report to the report file with:
- What changed per file (line-level)
- `npx tsc --noEmit` output (run once at the end)
- Any concerns

Short status reply: DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT + commits SHA + "tsc clean/errors" + report path.
