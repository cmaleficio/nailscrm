import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";
import { recomputeFinancialStatus } from "@/lib/financial-status";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await hasPermission(session, "balances"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const payment = db.select().from(schema.payments).where(eq(schema.payments.id, id)).get();
  if (!payment) {
    return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
  }
  db.delete(schema.payments).where(eq(schema.payments.id, id)).run();
  recomputeFinancialStatus(payment.userId);
  return NextResponse.json({ success: true });
}
