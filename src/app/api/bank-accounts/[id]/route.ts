import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, sql } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const existing = db.select().from(schema.bankAccounts).where(eq(schema.bankAccounts.id, id)).get();
  if (!existing) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const body = await req.json();
  const bankName =
    body.bankName !== undefined && typeof body.bankName === "string"
      ? body.bankName.trim()
      : existing.bankName;
  if (!bankName) {
    return NextResponse.json({ error: "El nombre del banco es requerido" }, { status: 400 });
  }
  const currency: "USD" | "VES" = body.currency !== undefined ? (body.currency === "VES" ? "VES" : "USD") : existing.currency;
  const accountType: "savings" | "checking" | "cash" =
    body.accountType !== undefined
      ? body.accountType === "checking"
        ? "checking"
        : body.accountType === "cash"
          ? "cash"
          : "savings"
      : existing.accountType;
  const accountNumber =
    body.accountNumber !== undefined
      ? typeof body.accountNumber === "string" && body.accountNumber.trim()
        ? body.accountNumber.trim()
        : null
      : existing.accountNumber;
  const isActive =
    body.isActive !== undefined ? (body.isActive ? 1 : 0) : existing.isActive;
  const notes =
    body.notes !== undefined
      ? typeof body.notes === "string" && body.notes.trim()
        ? body.notes.trim()
        : null
      : existing.notes;
  db.update(schema.bankAccounts)
    .set({ bankName, accountType, accountNumber, currency, isActive, notes })
    .where(eq(schema.bankAccounts.id, id))
    .run();
  return NextResponse.json({ ...existing, bankName, accountType, accountNumber, currency, isActive, notes });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const count =
    db.select({ c: sql<number>`count(*)` }).from(schema.supplierPayments).where(eq(schema.supplierPayments.bankAccountId, id)).get()?.c ?? 0;
  if (count > 0) {
    return NextResponse.json(
      { error: "La cuenta tiene pagos asociados; desactívala en su lugar" },
      { status: 400 }
    );
  }
  db.delete(schema.bankAccounts).where(eq(schema.bankAccounts.id, id)).run();
  return NextResponse.json({ success: true });
}
