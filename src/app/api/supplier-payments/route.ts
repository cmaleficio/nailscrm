import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, desc } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";
import { recomputeBillStatus } from "@/lib/bills";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await hasPermission(session, "accountsPayable"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const billId = req.nextUrl.searchParams.get("billId");
  const q = db
    .select({
      id: schema.supplierPayments.id,
      billId: schema.supplierPayments.billId,
      supplierName: schema.suppliers.name,
      invoiceNumber: schema.bills.invoiceNumber,
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
    .innerJoin(schema.bills, eq(schema.bills.id, schema.supplierPayments.billId))
    .leftJoin(schema.suppliers, eq(schema.suppliers.id, schema.bills.supplierId))
    .leftJoin(schema.bankAccounts, eq(schema.bankAccounts.id, schema.supplierPayments.bankAccountId));
  const rows = billId
    ? q.where(eq(schema.supplierPayments.billId, billId)).orderBy(desc(schema.supplierPayments.paymentDate)).all()
    : q.orderBy(desc(schema.supplierPayments.paymentDate)).all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const adminId = session?.user?.id;
  if (!adminId || !(await hasPermission(session, "accountsPayable"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const bill = db.select().from(schema.bills).where(eq(schema.bills.id, body.billId)).get();
  if (!bill) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }
  const currency: "USD" | "VES" = body.currency === "VES" ? "VES" : "USD";
  let usd = 0;
  if (currency === "VES") {
    if (typeof body.amountVes !== "number" || typeof body.rate !== "number" || body.rate <= 0 || body.amountVes <= 0) {
      return NextResponse.json({ error: "amountVes y rate son requeridos para pagos en Bs" }, { status: 400 });
    }
    usd = Math.round((body.amountVes / body.rate) * 100) / 100;
  } else {
    if (typeof body.amountUsd !== "number" || body.amountUsd <= 0) {
      return NextResponse.json({ error: "amountUsd es requerido" }, { status: 400 });
    }
    usd = Math.round(body.amountUsd * 100) / 100;
  }
  if (typeof body.reference !== "string" || !body.reference.trim()) {
    return NextResponse.json({ error: "La referencia es requerida" }, { status: 400 });
  }
  if (typeof body.photoUrl !== "string" || !body.photoUrl.trim()) {
    return NextResponse.json({ error: "La captura del pago es requerida" }, { status: 400 });
  }
  const now = Math.floor(Date.now() / 1000);
  const payment = {
    id: crypto.randomUUID(),
    billId: body.billId,
    bankAccountId: body.bankAccountId ?? null,
    amountUsd: usd,
    currency,
    amountVes: currency === "VES" ? body.amountVes : null,
    rate: currency === "VES" ? body.rate : null,
    paymentDate: typeof body.paymentDate === "number" ? body.paymentDate : now,
    reference: body.reference.trim(),
    photoUrl: body.photoUrl.trim(),
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    createdBy: adminId,
    createdAt: now,
  };
  db.insert(schema.supplierPayments).values(payment).run();
  recomputeBillStatus(body.billId);
  return NextResponse.json(payment, { status: 201 });
}
