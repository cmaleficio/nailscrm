import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, and, sql, inArray, desc } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";
import { createInventoryIn } from "@/lib/inventory";
import { monthRange } from "@/lib/financials";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await hasPermission(session, "purchases"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const conditions = [];
  const status = sp.get("status");
  if (status === "pending" || status === "partial" || status === "paid") {
    conditions.push(eq(schema.bills.status, status));
  }
  const supplierId = sp.get("supplierId");
  if (supplierId) conditions.push(eq(schema.bills.supplierId, supplierId));
  const type = sp.get("type");
  if (type === "inventory" || type === "fixed") conditions.push(eq(schema.bills.type, type));
  const month = sp.get("month");
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const { start, end } = monthRange(month);
    conditions.push(and(sql`${schema.bills.billDate} >= ${start}`, sql`${schema.bills.billDate} < ${end}`));
  }

  const rows = db
    .select({
      id: schema.bills.id,
      supplierId: schema.bills.supplierId,
      supplierName: schema.suppliers.name,
      categoryId: schema.bills.categoryId,
      categoryName: schema.expenseCategories.name,
      invoiceNumber: schema.bills.invoiceNumber,
      type: schema.bills.type,
      billDate: schema.bills.billDate,
      dueDate: schema.bills.dueDate,
      currency: schema.bills.currency,
      amountVes: schema.bills.amountVes,
      rate: schema.bills.rate,
      totalUsd: schema.bills.totalUsd,
      status: schema.bills.status,
      notes: schema.bills.notes,
      createdAt: schema.bills.createdAt,
    })
    .from(schema.bills)
    .leftJoin(schema.suppliers, eq(schema.suppliers.id, schema.bills.supplierId))
    .leftJoin(schema.expenseCategories, eq(schema.expenseCategories.id, schema.bills.categoryId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.bills.billDate))
    .all();

  const ids = rows.map((r) => r.id);
  const paidMap = new Map<string, number>();
  const itemsByBill = new Map<
    string,
    { id: string; billId: string; inventoryItemId: string | null; inventoryItemName: string | null; description: string | null; quantity: number; unitCostUsd: number; totalUsd: number }[]
  >();
  if (ids.length > 0) {
    const paidRows = db
      .select({
        billId: schema.supplierPayments.billId,
        s: sql<number>`coalesce(sum(${schema.supplierPayments.amountUsd}), 0)`,
      })
      .from(schema.supplierPayments)
      .where(inArray(schema.supplierPayments.billId, ids))
      .groupBy(schema.supplierPayments.billId)
      .all();
    for (const p of paidRows) paidMap.set(p.billId, p.s ?? 0);
    const allItems = db
      .select({
        id: schema.billItems.id,
        billId: schema.billItems.billId,
        inventoryItemId: schema.billItems.inventoryItemId,
        inventoryItemName: schema.inventoryItems.name,
        description: schema.billItems.description,
        quantity: schema.billItems.quantity,
        unitCostUsd: schema.billItems.unitCostUsd,
        totalUsd: schema.billItems.totalUsd,
      })
      .from(schema.billItems)
      .leftJoin(schema.inventoryItems, eq(schema.billItems.inventoryItemId, schema.inventoryItems.id))
      .where(inArray(schema.billItems.billId, ids))
      .all();
    for (const it of allItems) {
      const arr = itemsByBill.get(it.billId) ?? [];
      arr.push(it);
      itemsByBill.set(it.billId, arr);
    }
  }

  return NextResponse.json(
    rows.map((r) => ({ ...r, paidUsd: paidMap.get(r.id) ?? 0, items: itemsByBill.get(r.id) ?? [] }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const adminId = session?.user?.id;
  if (!adminId || !(await hasPermission(session, "purchases"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const type: "inventory" | "fixed" = body.type === "fixed" ? "fixed" : "inventory";
  const currency: "USD" | "VES" = body.currency === "VES" ? "VES" : "USD";

  if (type === "inventory" && currency !== "USD") {
    return NextResponse.json(
      { error: "Las facturas de inventario se registran en USD" },
      { status: 400 }
    );
  }

  let totalUsd = 0;
  if (currency === "VES") {
    if (typeof body.amountVes !== "number" || typeof body.rate !== "number" || body.rate <= 0 || body.amountVes <= 0) {
      return NextResponse.json({ error: "amountVes y rate son requeridos para facturas en Bs" }, { status: 400 });
    }
    totalUsd = Math.round((body.amountVes / body.rate) * 100) / 100;
  } else {
    if (type === "inventory") {
      if (!Array.isArray(body.items) || body.items.length === 0) {
        return NextResponse.json({ error: "La factura de inventario requiere al menos un item" }, { status: 400 });
      }
      totalUsd = 0;
      for (const it of body.items) {
        const qty = Number(it.quantity);
        const unit = Number(it.unitCostUsd);
        if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unit) || unit < 0) {
          return NextResponse.json({ error: "Cada item requiere cantidad > 0 y costo unitario >= 0" }, { status: 400 });
        }
        totalUsd += Math.round(qty * unit * 100) / 100;
      }
      totalUsd = Math.round(totalUsd * 100) / 100;
    } else {
      const t = Number(body.totalUsd);
      if (!Number.isFinite(t) || t <= 0) {
        return NextResponse.json({ error: "totalUsd es requerido" }, { status: 400 });
      }
      totalUsd = Math.round(t * 100) / 100;
    }
  }

  const billDate = typeof body.billDate === "number" ? body.billDate : Math.floor(Date.now() / 1000);
  const now = Math.floor(Date.now() / 1000);
  const bill: typeof schema.bills.$inferInsert = {
    id: crypto.randomUUID(),
    supplierId: body.supplierId ?? null,
    categoryId: body.categoryId ?? null,
    invoiceNumber: typeof body.invoiceNumber === "string" && body.invoiceNumber.trim() ? body.invoiceNumber.trim() : null,
    type,
    billDate,
    dueDate: typeof body.dueDate === "number" ? body.dueDate : null,
    currency,
    amountVes: currency === "VES" ? body.amountVes : null,
    rate: currency === "VES" ? body.rate : null,
    totalUsd,
    status: "pending",
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    createdBy: adminId,
    createdAt: now,
  };
  db.insert(schema.bills).values(bill).run();

  if (type === "inventory") {
    for (const it of body.items) {
      const qty = Number(it.quantity);
      const unit = Math.round(Number(it.unitCostUsd) * 100) / 100;
      db.insert(schema.billItems)
        .values({
          id: crypto.randomUUID(),
          billId: bill.id,
          inventoryItemId: it.inventoryItemId ?? null,
          description: typeof it.description === "string" && it.description.trim() ? it.description.trim() : null,
          quantity: qty,
          unitCostUsd: unit,
          totalUsd: Math.round(qty * unit * 100) / 100,
        })
        .run();
      if (it.inventoryItemId) {
        createInventoryIn(it.inventoryItemId, qty, unit, "bill", bill.id, bill.notes ?? null, adminId);
      }
    }
  }

  return NextResponse.json(bill, { status: 201 });
}
