import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const result = db
    .delete(schema.exchangeRates)
    .where(eq(schema.exchangeRates.id, id))
    .run();
  if (result.changes === 0) {
    return NextResponse.json({ error: "No se encontró la tasa" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
