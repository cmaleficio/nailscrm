import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, and } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const photos = db
    .select({ id: schema.appointmentPhotos.id, url: schema.appointmentPhotos.url })
    .from(schema.appointmentPhotos)
    .where(
      and(
        eq(schema.appointmentPhotos.appointmentId, id),
        eq(schema.appointmentPhotos.kind, "reference")
      )
    )
    .orderBy(schema.appointmentPhotos.position)
    .all();
  return NextResponse.json(photos);
}
