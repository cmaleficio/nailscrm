import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const session = await auth();
  if (!(await isAdmin(session))) {
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
  return NextResponse.json({ success: true });
}
