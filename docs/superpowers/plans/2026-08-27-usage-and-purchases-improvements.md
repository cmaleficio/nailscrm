# Mejoras Compras/Inventario + Usos por Cita — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 4 mejoras: código de producto automático, edición de facturas, usos reales por cita con categorías/subcategorías de esmalte, y agotado + máximo de usos por producto.

**Architecture:** Cambios en `src/db/schema.ts` (+ migración), en routes de la API (`inventory/items`, `appointments/[id]`, nuevo sub-ruta `exhaust`), y en componentes UI (`PurchasesContent`, `BillFormDialog`, `InventoryContent`, `CompleteAppointmentDialog`).

**Tech Stack:** Next.js 16 (App Router), TypeScript, Drizzle ORM (SQLite/better-sqlite3), Tailwind v4.

## Global Constraints

- SQL puro vía Drizzle (no Prisma). Queries simples: `db.select()/.from()/.where()`.
- UI en español. Paleta pastel (rosa, blanco, grises). `rounded-xl`, sombras suaves.
- Todas las fechas en timestamp Unix (segundos), timezone America/Caracas.
- No hay framework de tests en el repo. Verificación = `npm run lint`, `npx tsc --noEmit`, y `npm run build`.
- No añadir comentarios al código salvo que se pidan.
- Actualizar README.md, CHANGELOG.md y AGENTS.md al final (mismo commit).
- `npm run db:generate` + `npm run db:migrate` para aplicar el cambio de schema.

---

### Task 1: Migración de schema (campos de esmalte + tabla appointment_usage)

**Files:**
- Modify: `src/db/schema.ts`
- Generate migration via `npm run db:generate`, apply via `npm run db:migrate`

**Interfaces:**
- Produces: campos `category`, `subcategory`, `maxUses`, `usesConsumed`, `isExhausted` en `inventory_items`; tabla `appointmentUsage` exportada desde `schema`.

- [ ] **Step 1: Añadir campos a `inventoryItems` en `src/db/schema.ts`**

Dentro de la definición existente de `inventoryItems`, añadir tras `photoUrl`:

```ts
  category: text("category"),
  subcategory: text("subcategory"),
  maxUses: integer("max_uses"),
  usesConsumed: integer("uses_consumed").notNull().default(0),
  isExhausted: integer("is_exhausted").notNull().default(0),
```

- [ ] **Step 2: Añadir la tabla `appointmentUsage` al final de `src/db/schema.ts`**

```ts
export const appointmentUsage = sqliteTable(
  "appointment_usage",
  {
    id: text("id").primaryKey(),
    appointmentId: text("appointment_id").notNull().references(() => appointments.id, { onDelete: "cascade" }),
    inventoryItemId: text("inventory_item_id").notNull().references(() => inventoryItems.id),
    quantity: real("quantity").notNull().default(1),
  },
  (t) => [uniqueIndex("appointment_usage_unique_idx").on(t.appointmentId, t.inventoryItemId)]
);
```

- [ ] **Step 3: Generar y aplicar migración**

Run: `npm run db:generate`
Expected: se crea un nuevo archivo en `drizzle/` con `ALTER TABLE inventory_items ADD COLUMN ...` y `CREATE TABLE appointment_usage`.

Run: `npm run db:migrate`
Expected: migración aplicada sin errores.

- [ ] **Step 4: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

---

### Task 2: Código de producto automático

**Files:**
- Modify: `src/app/api/inventory/items/route.ts`
- Modify: `src/app/(admin)/dashboard/inventory/InventoryContent.tsx`

**Interfaces:**
- Consumes: `db`, `schema`, `hasPermission`.
- Produces: `nextAutoCode()` (helper local a la route) que devuelve un string `PRD-<n>`.

- [ ] **Step 1: Implementar `nextAutoCode()` y usarlo en POST**

En `src/app/api/inventory/items/route.ts`, añadir antes de `export async function POST`:

```ts
function nextAutoCode(): string {
  const rows = db.select({ id: schema.inventoryItems.id }).from(schema.inventoryItems).all();
  let maxN = 0;
  for (const r of rows) {
    const m = /PRD-(\d+)/.exec(r.id);
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  return `PRD-${maxN + 1}`;
}
```

En `POST`, cambiar la validación. Actualmente exige código válido. Reemplazar:

```ts
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }
  if (!/^[A-Za-z0-9_-]+$/.test(code)) {
    return NextResponse.json({ error: "El código de producto es requerido y solo admite letras, números, guiones y guiones bajos" }, { status: 400 });
  }
  const exists = db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.id, code)).get();
  if (exists) {
    return NextResponse.json({ error: "Ya existe un producto con ese código" }, { status: 400 });
  }
```

por:

```ts
  const name = typeof body.name === "string" ? body.name.trim() : "";
  let code = typeof body.code === "string" ? body.code.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }
  if (code) {
    if (!/^[A-Za-z0-9_-]+$/.test(code)) {
      return NextResponse.json({ error: "El código solo admite letras, números, guiones y guiones bajos" }, { status: 400 });
    }
    const exists = db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.id, code)).get();
    if (exists) {
      return NextResponse.json({ error: "Ya existe un producto con ese código" }, { status: 400 });
    }
  } else {
    code = nextAutoCode();
  }
```

Añadir también los campos nuevos al insertar (para permitir crearse con categoría/subcategoría desde el formulario del diálogo de completo, aunque en creación inicial pueden ser null):

```ts
  const category = typeof body.category === "string" && body.category.trim() ? body.category.trim() : null;
  const subcategory = typeof body.subcategory === "string" && body.subcategory.trim() ? body.subcategory.trim() : null;
```

y en el objeto `row`:

```ts
    category,
    subcategory,
    maxUses: typeof body.maxUses === "number" && body.maxUses > 0 ? body.maxUses : null,
    usesConsumed: 0,
    isExhausted: 0,
```

- [ ] **Step 2: Actualizar `InventoryContent` para que el código sea opcional**

En `src/app/(admin)/dashboard/inventory/InventoryContent.tsx`:

- Cambiar el placeholder del input de código a: `"Código (opcional, se genera solo)"`.
- Añadir bajo los inputs un texto pequeño (opcional) con `text-xs text-gray-400` indicando que se genera automáticamente si se deja vacío.
- Cambiar la condición de deshabilitado del botón "+ Producto" de `!newItemForm.code.trim()` a solo `!newItemForm.name.trim()`:

```tsx
              disabled={busy || uploading || !newItemForm.name.trim()}
```

- [ ] **Step 3: Verificar**

Run: `npm run lint`
Run: `npx tsc --noEmit`
Expected: sin errores.

---

### Task 3: Corregir edición de facturas

**Files:**
- Modify: `src/app/(admin)/dashboard/purchases/PurchasesContent.tsx`

**Interfaces:**
- Consumes: `setEditingBill`, `setShowForm`.

- [ ] **Step 1: Abrir el diálogo al editar**

En `PurchasesContent.tsx`, la función `openEdit` actualmente solo hace `setEditingBill({...})`. Añadir `setShowForm(true);` dentro de la rama `if (res.ok)` después de `setEditingBill`:

```ts
      setEditingBill({
        ...data,
        supplierId: data.supplierId ?? null,
        categoryId: data.categoryId ?? null,
        supplierName: data.supplierName ?? null,
        categoryName: data.categoryName ?? null,
        invoiceNumber: data.invoiceNumber ?? null,
        amountVes: data.amountVes ?? null,
        rate: data.rate ?? null,
        notes: data.notes ?? null,
        dueDate: data.dueDate ?? null,
        items: data.items ?? [],
      });
      setShowForm(true);
```

- [ ] **Step 2: Verificar**

Run: `npm run lint`
Run: `npx tsc --noEmit`
Expected: sin errores.

---

### Task 4: Endpoint para marcar/reabrir producto agotado

**Files:**
- Create: `src/app/api/inventory/items/[id]/exhaust/route.ts` (o coexistir en el `[id]/route.ts` — ver nota)
- Modify: `src/lib/inventory.ts` (helper `setExhausted`)

**Interfaces:**
- Produces: `setExhausted(itemId, exhausted: boolean, createdBy): void` en `src/lib/inventory.ts`.
- Consumes: `db`, `schema`, `eq`, `applyManualMovement` (para poner stock 0), `hasPermission`, `session`.

- [ ] **Step 1: Añadir helper `setExhausted` en `src/lib/inventory.ts`**

```ts
export function setExhausted(itemId: string, exhausted: boolean, createdBy: string): void {
  const item = db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.id, itemId)).get();
  if (!item) throw new Error("Item de inventario no encontrado");
  if (exhausted && !item.isExhausted) {
    db.update(schema.inventoryItems).set({ isExhausted: 1, stock: 0 }).where(eq(schema.inventoryItems.id, itemId)).run();
    if (item.stock > 0.004) {
      applyManualMovement(itemId, "adjust", 0, "Agotado (stock a 0)", createdBy);
    }
  } else if (!exhausted && item.isExhausted) {
    db.update(schema.inventoryItems).set({ isExhausted: 0 }).where(eq(schema.inventoryItems.id, itemId)).run();
  }
}
```

- [ ] **Step 2: Añadir manejo de exhaust en `src/app/api/inventory/items/[id]/route.ts`**

En ese archivo, extender `PATCH` para aceptar el campo `exhausted` (boolean) que llama a `setExhausted`, y también aceptar `category`, `subcategory`, `maxUses`:

Tras el `const body = await req.json();`, añadir:

```ts
  if (body.exhausted === true || body.exhausted === false) {
    setExhausted(id, body.exhausted, session!.user!.id);
  }
  const category = body.category !== undefined
    ? (typeof body.category === "string" && body.category.trim() ? body.category.trim() : null)
    : existing.category;
  const subcategory = body.subcategory !== undefined
    ? (typeof body.subcategory === "string" && body.subcategory.trim() ? body.subcategory.trim() : null)
    : existing.subcategory;
  const maxUses = body.maxUses !== undefined
    ? (typeof body.maxUses === "number" && body.maxUses > 0 ? Math.floor(body.maxUses) : null)
    : existing.maxUses;
```

y añadir esos tres campos al `.set({ ... })` del `db.update`, y devolverlos en la respuesta JSON.

Actualizar el import: `import { reverseBillMovements, createInventoryIn, setExhausted } from "@/lib/inventory";` (si el archivo no importaba `inventory.ts`, añadir el import).

- [ ] **Step 3: Verificar**

Run: `npm run lint`
Run: `npx tsc --noEmit`
Expected: sin errores.

---

### Task 5: Registrar uso de esmaltes al completar cita

**Files:**
- Modify: `src/app/api/appointments/[id]/route.ts`
- Modify: `src/lib/inventory.ts` (helper `recordUsage`)

**Interfaces:**
- Produces: `recordUsage(appointmentId, usage: { inventoryItemId, quantity }[], createdBy): void` en `src/lib/inventory.ts`.
- Consumes: `db`, `schema`, `eq`, `sql` (upsert), `createInventoryIn` no; usa deducción manual.

- [ ] **Step 1: Añadir `recordUsage` en `src/lib/inventory.ts`**

```ts
export function recordUsage(
  appointmentId: string,
  usage: { inventoryItemId: string; quantity: number }[],
  createdBy: string
): void {
  const now = Math.floor(Date.now() / 1000);
  for (const u of usage) {
    const item = db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.id, u.inventoryItemId)).get();
    if (!item) throw new Error("Item de inventario no encontrado");
    const qty = Number(u.quantity);
    if (!Number.isFinite(qty) || qty < 0) throw new Error("Cantidad inválida");

    db.insert(schema.appointmentUsage)
      .values({ id: crypto.randomUUID(), appointmentId, inventoryItemId: u.inventoryItemId, quantity: qty })
      .onConflictDoUpdate({ target: [schema.appointmentUsage.appointmentId, schema.appointmentUsage.inventoryItemId], set: { quantity: qty } })
      .run();

    const newStock = Math.round((item.stock - qty) * 100) / 100;
    const newUses = (item.usesConsumed ?? 0) + 1;
    db.update(schema.inventoryItems)
      .set({
        stock: newStock,
        usesConsumed: newUses,
        isExhausted: item.maxUses != null && newUses >= item.maxUses ? 1 : item.isExhausted,
      })
      .where(eq(schema.inventoryItems.id, u.inventoryItemId))
      .run();

    db.insert(schema.inventoryMovements)
      .values({
        id: crypto.randomUUID(),
        inventoryItemId: u.inventoryItemId,
        kind: "out",
        quantity: qty > 0 ? -qty : 0,
        unitCostUsd: null,
        refType: "usage",
        refId: appointmentId,
        notes: "Uso en cita",
        createdBy,
        createdAt: now,
      })
      .run();
  }
}
```

- [ ] **Step 2: Llamar `recordUsage` al completar**

En `src/app/api/appointments/[id]/route.ts`, dentro del bloque `if (status === "completed" && appointment.status !== "completed")`, después de manejar las fotos (o antes del `if (status)` final), añadir:

```ts
    const usage: { inventoryItemId: string; quantity: number }[] = Array.isArray(body.usage)
      ? body.usage
          .filter((x: unknown) => x && typeof (x as { inventoryItemId?: unknown }).inventoryItemId === "string")
          .map((x) => ({
            inventoryItemId: (x as { inventoryItemId: string }).inventoryItemId,
            quantity: Number((x as { quantity?: unknown }).quantity) || 1,
          }))
      : [];
    if (usage.length > 0) {
      recordUsage(id, usage, session!.user!.id);
    }
```

Añadir el import: `import { recordUsage } from "@/lib/inventory";`.

Nota: este PATCH usa `isAdmin(session)` (no `hasPermission`) y `session.user.id` existe dentro de la ramificación admin. Asegurar que `createdBy` no sea undefined; usar `session?.user?.id ?? ""` si es necesario.

- [ ] **Step 3: Verificar**

Run: `npm run lint`
Run: `npx tsc --noEmit`
Expected: sin errores.

---

### Task 6: UI — sección "Productos usados" en Completar cita

**Files:**
- Modify: `src/components/CompleteAppointmentDialog.tsx`

**Interfaces:**
- Consumes: `fetch("/api/inventory/items")` (devuelve items con `category`, `subcategory`, `isExhausted`, `stock`), `appointmentId`.
- Produces: envía `usage` en el PATCH de completar.

- [ ] **Step 1: Cargar y agrupar esmaltes**

Añadir estado:

```ts
  const [esmalters, setEsmalters] = useState<{ id: string; name: string; category: string | null; subcategory: string | null; stock: number; isExhausted: number }[]>([]);
  const [usageSel, setUsageSel] = useState<Record<string, string>>({});
```

En `useEffect`, junto a la carga de la tasa:

```ts
    fetch("/api/inventory/items").then((r) => r.json()).then((data) => {
      const arr = Array.isArray(data) ? data : [];
      setEsmalters(arr.filter((i: { category?: string | null }) => !!i.category));
    }).catch(() => {});
```

- [ ] **Step 2: Renderizar la sección entre fotos y pago**

Tras el bloque de fotos (`{previews.length > 0 && ...}`), añadir una sección "Productos usados" que agrupe por `category` y dentro por `subcategory`:

```tsx
        <div className="mt-5 rounded-xl border border-gray-200 p-4">
          <p className="mb-1 text-sm font-medium text-gray-700">Productos usados (esmaltes)</p>
          <p className="mb-3 text-xs text-gray-400">Marca qué esmaltes se usaron en esta cita para calcular cuántos usos te duran.</p>
          {esmalters.length === 0 ? (
            <p className="text-sm text-gray-400">No hay esmaltes con categoría registrados.</p>
          ) : (
            (() => {
              const byCat: Record<string, { id: string; name: string; subcategory: string | null; stock: number; isExhausted: number }[]> = {};
              for (const e of esmalters) {
                const key = e.category ?? "Otros";
                (byCat[key] ??= []).push(e);
              }
              return Object.entries(byCat).map(([cat, items]) => (
                <div key={cat} className="mb-3">
                  <p className="mb-1 text-xs font-semibold uppercase text-gray-500">{cat}</p>
                  {items.map((e) => (
                    <div key={e.id} className="mb-1 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={usageSel[e.id] !== undefined}
                        onChange={(ev) => {
                          const next = { ...usageSel };
                          if (ev.target.checked) next[e.id] = "1";
                          else delete next[e.id];
                          setUsageSel(next);
                        }}
                        className="h-4 w-4"
                      />
                      <span className="min-w-0 flex-1 text-sm text-gray-700">
                        {e.subcategory ? `${e.subcategory} — ` : ""}{e.name}
                        {e.isExhausted ? <span className="ml-1 text-xs text-red-500">Agotado</span> : null}
                      </span>
                      {usageSel[e.id] !== undefined && (
                        <input
                          type="number"
                          min="0"
                          value={usageSel[e.id]}
                          onChange={(ev) => setUsageSel((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                          className="w-16 rounded-xl border border-gray-200 px-2 py-1 text-sm"
                        />
                      )}
                    </div>
                  ))}
                </div>
              ));
            })()
          )}
        </div>
```

- [ ] **Step 3: Enviar `usage` al completar**

En el cuerpo del PATCH de completar, tras `finalPhotos`, añadir:

```ts
        const usage = Object.entries(usageSel)
          .filter(([_, q]) => Number(q) > 0)
          .map(([inventoryItemId, quantity]) => ({ inventoryItemId, quantity: Number(quantity) }));
```

y en el `body` del PATCH:

```ts
        body: JSON.stringify({ status: "completed", finalPhotos: urls, usage }),
```

- [ ] **Step 4: Verificar**

Run: `npm run lint`
Run: `npx tsc --noEmit`
Expected: sin errores.

---

### Task 7: UI — Inventario con categoría/subcategoría, máx usos, usos y botón agotado

**Files:**
- Modify: `src/app/(admin)/dashboard/inventory/InventoryContent.tsx`

**Interfaces:**
- Consumes: `PATCH /api/inventory/items/[id]` con `category`, `subcategory`, `maxUses`, `exhausted`.
- Produces: tabla y formulario de edición actualizados.

- [ ] **Step 1: Extender tipos**

En `InventoryContent.tsx`, extender `InventoryItem`:

```ts
  category: string | null;
  subcategory: string | null;
  maxUses: number | null;
  usesConsumed: number;
  isExhausted: number;
```

Extender `editForm` inicial y `newItemForm`:

```ts
  const [newItemForm, setNewItemForm] = useState({ code: "", name: "", unit: "unidad", minStock: "0", barcode: "", photoUrl: "", category: "", subcategory: "", maxUses: "" });
  const [editForm, setEditForm] = useState({ name: "", unit: "", minStock: "0", isActive: 1, category: "", subcategory: "", maxUses: "" });
```

- [ ] **Step 2: Formulario nuevo producto — añadir categoría/subcategoría/máx usos**

En el grid del formulario "Nuevo producto", añadir campo categoria y subcategoria y maxUses. En `createItem`, enviar también `category`, `subcategory`, `maxUses`:

```ts
        body: JSON.stringify({
          code: newItemForm.code.trim(),
          name,
          unit: newItemForm.unit.trim(),
          minStock: Number(newItemForm.minStock) || 0,
          barcode: newItemForm.barcode.trim(),
          photoUrl: newItemForm.photoUrl,
          category: newItemForm.category.trim(),
          subcategory: newItemForm.subcategory.trim(),
          maxUses: newItemForm.maxUses ? Number(newItemForm.maxUses) : null,
        }),
```

Y resetear el form incluyendo los nuevos campos.

- [ ] **Step 3: Tabla — mostrar categoría/subcategoría/usos/badge agotado**

En la celda de nombre (o una columna nueva), mostrar:

```tsx
                          {item.isExhausted === 1 && <span className="ml-1 rounded-lg bg-red-600 px-2 py-0.5 text-xs font-medium text-white">Agotado</span>}
                          {item.category && (
                            <span className="ml-1 text-xs text-gray-400">
                              {item.category}{item.subcategory ? ` / ${item.subcategory}` : ""}
                            </span>
                          )}
                          {item.maxUses && (
                            <span className="ml-1 text-xs text-gray-400">
                              · {item.usesConsumed}/{item.maxUses} usos
                            </span>
                          )}
```

- [ ] **Step 4: Edición — campos nuevos + botón agotado**

En el bloque de edición (`editingId === item.id`), añadir inputs de `category`, `subcategory`, `maxUses` y un botón que alterna el estado. En `saveEdit`, enviar también:

```ts
        body: JSON.stringify({
          name: editForm.name.trim(),
          unit: editForm.unit.trim(),
          minStock: Number(editForm.minStock) || 0,
          isActive: editForm.isActive === 1,
          category: editForm.category.trim(),
          subcategory: editForm.subcategory.trim(),
          maxUses: editForm.maxUses ? Number(editForm.maxUses) : null,
        }),
```

Añadir un botón "Marcar agotado" / "Reabrir" en la fila de acciones que hace un PATCH con `exhausted`:

```ts
  async function toggleExhausted(item: InventoryItem) {
    setBusy(true);
    try {
      await fetch(`/api/inventory/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exhausted: item.isExhausted === 1 ? false : true }),
      });
      setEditingId(null);
      await loadItems();
    } finally {
      setBusy(false);
    }
  }
```

Y llamarlo desde un botón (puede incluirse dentro del bloque de edición o en acciones).

- [ ] **Step 5: Verificar**

Run: `npm run lint`
Run: `npx tsc --noEmit`
Expected: sin errores.

---

### Task 8: Build de producción + documentación

**Files:**
- Modify: `README.md`, `CHANGELOG.md`, `AGENTS.md`

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: build OK sin errores de tipos ni lint.

- [ ] **Step 2: Actualizar CHANGELOG.md**

Añadir una entrada con las 4 mejoras (fecha 2026-08-27).

- [ ] **Step 3: Actualizar README.md**

Documentar: código de producto auto-generado, edición de facturas, categoría/subcategoría en esmaltes, uso por cita y máximo/agotado.

- [ ] **Step 4: Actualizar AGENTS.md**

Añadir a la sección de modelo de datos: campos nuevos de `inventory_items`, tabla `appointment_usage`, y a componente/vistas: sección de usos en CompleteAppointmentDialog y campos en InventoryContent; endpoints `recordUsage`/`setExhausted`.

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "feat: usos por cita, agotado, código automático y edición de facturas"
```
