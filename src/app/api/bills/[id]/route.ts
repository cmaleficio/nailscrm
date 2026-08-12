import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, sql, desc } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";
import { reverseBillMovements, createInventoryIn } from "@/lib/inventory";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await hasPermission(session, "purchases"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const bill = db.select().from(schema.bills).where(eq(schema.bills.id, id)).get();
  if (!bill) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }
  const items = db.select().from(schema.billItems).where(eq(schema.billItems.billId, id)).orderBy(schema.billItems.id).all();
  const payments = db
    .select({
      id: schema.supplierPayments.id,
      billId: schema.supplierPayments.billId,
      bankAccountId: schema.supplierPayments.bankAccountId,
      bankName: schema.bankAccounts.bankName,
      amountUsd: schema.supplierPayments.amountUsd,
      currency: schema.supplierPayments.currency,
      amountVes: schema.supplierPayments.amountVes,
      rate: schema.supplierPayments.rate,
      paymentDate: schema.supplierPayments.paymentDate,
      reference: schema.supplierPayments.reference,
      notes: schema.supplierPayments.notes,
      createdAt: schema.supplierPayments.createdAt,
    })
    .from(schema.supplierPayments)
    .leftJoin(schema.bankAccounts, eq(schema.bankAccounts.id, schema.supplierPayments.bankAccountId))
    .where(eq(schema.supplierPayments.billId, id))
    .orderBy(desc(schema.supplierPayments.paymentDate))
    .all();
  const paidUsd = payments.reduce((s, p) => s + p.amountUsd, 0);
  return NextResponse.json({ ...bill, items, payments, paidUsd });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const adminId = session?.user?.id;
  if (!adminId || !(await hasPermission(session, "purchases"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const bill = db.select().from(schema.bills).where(eq(schema.bills.id, id)).get();
  if (!bill) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }
  const body = await req.json();
  const hasPayments =
    db.select({ c: sql<number>`count(*)` }).from(schema.supplierPayments).where(eq(schema.supplierPayments.billId, id)).get()?.c ?? 0 > 0;

  if (hasPayments) {
    const locked = body.type !== undefined && body.type !== bill.type;
    const lockedCur = body.currency !== undefined && body.currency !== bill.currency;
    const lockedTotal = body.totalUsd !== undefined && Number(body.totalUsd) !== bill.totalUsd;
    const lockedItems = body.items !== undefined;
    if (locked || lockedCur || lockedTotal || lockedItems) {
      return NextResponse.json(
        { error: "Con pagos asociados solo se pueden editar proveedor, categoría, número, fechas y notas" },
        { status: 400 }
      );
    }
  }

  const supplierId = body.supplierId !== undefined ? body.supplierId ?? null : bill.supplierId;
  const categoryId = body.categoryId !== undefined ? body.categoryId ?? null : bill.categoryId;
  const invoiceNumber =
    body.invoiceNumber !== undefined
      ? typeof body.invoiceNumber === "string" && body.invoiceNumber.trim()
        ? body.invoiceNumber.trim()
        : null
      : bill.invoiceNumber;
  const billDate = body.billDate !== undefined && typeof body.billDate === "number" ? body.billDate : bill.billDate;
  const dueDate = body.dueDate !== undefined ? (typeof body.dueDate === "number" ? body.dueDate : null) : bill.dueDate;
  const notes =
    body.notes !== undefined
      ? typeof body.notes === "string" && body.notes.trim()
        ? body.notes.trim()
        : null
      : bill.notes;

  const type: "inventory" | "fixed" =
    body.type !== undefined && !hasPayments ? (body.type === "fixed" ? "fixed" : "inventory") : bill.type;

  db.update(schema.bills)
    .set({ supplierId, categoryId, invoiceNumber, billDate, dueDate, notes, type })
    .where(eq(schema.bills.id, id))
    .run();

  if (!hasPayments && body.items !== undefined) {
    reverseBillMovements(id, adminId);
    db.delete(schema.billItems).where(eq(schema.billItems.billId, id)).run();
    if (type === "inventory") {
      if (!Array.isArray(body.items) || body.items.length === 0) {
        return NextResponse.json({ error: "La factura de inventario requiere al menos un item" }, { status: 400 });
      }
      let totalUsd = 0;
      for (const it of body.items) {
        const qty = Number(it.quantity);
        const unit = Math.round(Number(it.unitCostUsd) * 100) / 100;
        if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unit) || unit < 0) {
          return NextResponse.json({ error: "Cada item requiere cantidad > 0 y costo unitario >= 0" }, { status: 400 });
        }
        const lineTotal = Math.round(qty * unit * 100) / 100;
        totalUsd += lineTotal;
        db.insert(schema.billItems)
          .values({
            id: crypto.randomUUID(),
            billId: id,
            inventoryItemId: it.inventoryItemId ?? null,
            description: typeof it.description === "string" && it.description.trim() ? it.description.trim() : null,
            quantity: qty,
            unitCostUsd: unit,
            totalUsd: lineTotal,
          })
          .run();
        if (it.inventoryItemId) {
          createInventoryIn(it.inventoryItemId, qty, unit, "bill", id, notes ?? bill.notes, adminId);
        }
      }
      totalUsd = Math.round(totalUsd * 100) / 100;
      db.update(schema.bills).set({ totalUsd }).where(eq(schema.bills.id, id)).run();
    }
  }

  const updated = db.select().from(schema.bills).where(eq(schema.bills.id, id)).get();
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const adminId = session?.user?.id;
  if (!adminId || !(await hasPermission(session, "purchases"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const bill = db.select().from(schema.bills).where(eq(schema.bills.id, id)).get();
  if (!bill) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }
  const paymentsCount =
    db.select({ c: sql<number>`count(*)` }).from(schema.supplierPayments).where(eq(schema.supplierPayments.billId, id)).get()?.c ?? 0;
  if (paymentsCount > 0) {
    return NextResponse.json(
      { error: "La factura tiene pagos asociados; elimina primero los pagos" },
      { status: 400 }
    );
  }
  if (bill.type === "inventory") {
    reverseBillMovements(id, adminId);
  }
  db.delete(schema.bills).where(eq(schema.bills.id, id)).run();
  return NextResponse.json({ success: true });
}
