import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";
import { recomputeBillStatus } from "@/lib/bills";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const p = db.select({ billId: schema.supplierPayments.billId }).from(schema.supplierPayments).where(eq(schema.supplierPayments.id, id)).get();
  if (!p) {
    return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
  }
  db.delete(schema.supplierPayments).where(eq(schema.supplierPayments.id, id)).run();
  recomputeBillStatus(p.billId);
  return NextResponse.json({ success: true });
}
