import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { join } from "path";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await hasPermission(session, "gallery"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const row = db
    .select()
    .from(schema.galleryPhotos)
    .where(eq(schema.galleryPhotos.id, id))
    .get();

  if (!row) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }

  db.delete(schema.galleryPhotos).where(eq(schema.galleryPhotos.id, id)).run();

  if (row.url.startsWith("/uploads/gallery/")) {
    try {
      await unlink(join(process.cwd(), "public", row.url));
    } catch {
      // el archivo puede ya no existir; no bloquea el borrado lógico
    }
  }

  return NextResponse.json({ success: true });
}
