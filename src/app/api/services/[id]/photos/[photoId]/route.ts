import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";
import { logActivity } from "@/lib/audit";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const session = await auth();
  if (!(await hasPermission(session, "services"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id, photoId } = await params;
  const photo = db
    .select()
    .from(schema.servicePhotos)
    .where(eq(schema.servicePhotos.id, photoId))
    .get();
  if (!photo || photo.serviceId !== id) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
}
  db.delete(schema.servicePhotos).where(eq(schema.servicePhotos.id, photoId)).run();
  logActivity(db, {
    entity: "service_photos",
    action: "delete",
    entityId: photoId,
    label: "Foto eliminada del servicio",
    metadata: { serviceId: id },
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
  return NextResponse.json({ success: true });
}

