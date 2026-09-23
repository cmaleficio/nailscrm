import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";
import { recomputeBillStatus } from "@/lib/bills";
import { logActivity } from "@/lib/audit";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await hasPermission(session, "accountsPayable"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const payment = db.select().from(schema.supplierPayments).where(eq(schema.supplierPayments.id, id)).get();
  if (!payment) {
    return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
  }
  db.delete(schema.supplierPayments).where(eq(schema.supplierPayments.id, id)).run();
  recomputeBillStatus(payment.billId);
  logActivity(db, {
    entity: "supplier_payments",
    action: "delete",
    entityId: payment.id,
    label: `Pago a proveedor eliminado: $${payment.amountUsd}`,
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
  return NextResponse.json({ success: true });
}
