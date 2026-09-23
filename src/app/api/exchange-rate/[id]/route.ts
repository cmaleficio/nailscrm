import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { logActivity } from "@/lib/audit";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const row = db
    .select({ date: schema.exchangeRates.date, rate: schema.exchangeRates.rate })
    .from(schema.exchangeRates)
    .where(eq(schema.exchangeRates.id, id))
    .get();
  if (!row) {
    return NextResponse.json({ error: "No se encontró la tasa" }, { status: 404 });
  }
  db.delete(schema.exchangeRates).where(eq(schema.exchangeRates.id, id)).run();
  logActivity(db, {
    entity: "exchange_rates",
    action: "delete",
    entityId: id,
    label: `Tasa eliminada`,
    metadata: { date: row.date, rate: row.rate },
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
  return NextResponse.json({ success: true });
}
