import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";
import { logActivity } from "@/lib/audit";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await hasPermission(session, "appointments"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const blockout = db
    .select()
    .from(schema.blockouts)
    .where(eq(schema.blockouts.id, id))
    .get();
  if (!blockout) {
    return NextResponse.json({ error: "Bloqueo no encontrado" }, { status: 404 });
  }
  db.delete(schema.blockouts).where(eq(schema.blockouts.id, id)).run();
  logActivity(db, {
    entity: "blockouts",
    action: "delete",
    entityId: blockout.id,
    label: `Bloqueo eliminado: ${blockout.reason ?? "sin motivo"}`,
    metadata: { startTime: blockout.startTime, endTime: blockout.endTime },
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
  return NextResponse.json({ success: true });
}
