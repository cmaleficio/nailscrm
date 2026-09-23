import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { and, eq, desc } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";
import { logActivity } from "@/lib/audit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;

  const appointment = db
    .select({
      id: schema.appointments.id,
      sharedToGallery: schema.appointments.sharedToGallery,
      finalPhotoUrl: schema.appointments.finalPhotoUrl,
    })
    .from(schema.appointments)
    .where(eq(schema.appointments.id, id))
    .get();

  if (!appointment) {
    return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
  }

  const photos = db
    .select({
      id: schema.appointmentPhotos.id,
      url: schema.appointmentPhotos.url,
      position: schema.appointmentPhotos.position,
      createdAt: schema.appointmentPhotos.createdAt,
    })
    .from(schema.appointmentPhotos)
    .where(
      and(
        eq(schema.appointmentPhotos.appointmentId, id),
        eq(schema.appointmentPhotos.kind, "final")
      )
    )
    .orderBy(schema.appointmentPhotos.position)
    .all();

  return NextResponse.json({
    sharedToGallery: appointment.sharedToGallery ?? 0,
    finalPhotoUrl: appointment.finalPhotoUrl,
    photos,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;

  const appointment = db
    .select({ id: schema.appointments.id, sharedToGallery: schema.appointments.sharedToGallery })
    .from(schema.appointments)
    .where(eq(schema.appointments.id, id))
    .get();

  if (!appointment) {
    return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
  }

  const formData = await req.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No se enviaron archivos" }, { status: 400 });
  }

  const uploadDir = join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });

  const lastPosition = db
    .select({ position: schema.appointmentPhotos.position })
    .from(schema.appointmentPhotos)
    .where(
      and(
        eq(schema.appointmentPhotos.appointmentId, id),
        eq(schema.appointmentPhotos.kind, "final")
      )
    )
    .orderBy(desc(schema.appointmentPhotos.position))
    .limit(1)
    .get();

  let nextPosition = (lastPosition?.position ?? -1) + 1;
  const now = Math.floor(Date.now() / 1000);
  const created: { id: string; url: string; position: number }[] = [];

  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${crypto.randomUUID()}.${ext}`;
    await writeFile(join(uploadDir, filename), buffer);
    const url = `/uploads/${filename}`;
    const photoId = crypto.randomUUID();
    db.insert(schema.appointmentPhotos)
      .values({
        id: photoId,
        appointmentId: id,
        url,
        position: nextPosition,
        createdAt: now,
        kind: "final",
      })
      .run();
    created.push({ id: photoId, url, position: nextPosition });
    nextPosition += 1;
  }

  const existingFinal = db
    .select({ url: schema.appointmentPhotos.url })
    .from(schema.appointmentPhotos)
    .where(
      and(
        eq(schema.appointmentPhotos.appointmentId, id),
        eq(schema.appointmentPhotos.kind, "final")
      )
    )
    .orderBy(schema.appointmentPhotos.position)
    .limit(1)
    .get();

  if (existingFinal) {
    db.update(schema.appointments)
      .set({ finalPhotoUrl: existingFinal.url })
      .where(eq(schema.appointments.id, id))
      .run();
  }

  logActivity(db, {
    entity: "appointments",
    action: "update",
    entityId: id,
    label: `Fotos finales agregadas a la cita`,
    metadata: { appointmentId: id, photoCount: created.length },
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });

  return NextResponse.json({ success: true, created });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;

  const url = new URL(req.url);
  const photoId = url.searchParams.get("photoId");
  if (!photoId) {
    return NextResponse.json({ error: "photoId es requerido" }, { status: 400 });
  }

  const photo = db
    .select()
    .from(schema.appointmentPhotos)
    .where(
      and(
        eq(schema.appointmentPhotos.id, photoId),
        eq(schema.appointmentPhotos.appointmentId, id),
        eq(schema.appointmentPhotos.kind, "final")
      )
    )
    .get();

  if (!photo) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }

  if (photo.url.startsWith("/uploads/")) {
    const filePath = join(process.cwd(), "public", photo.url);
    try {
      await unlink(filePath);
    } catch {}
  }

  db.delete(schema.appointmentPhotos)
    .where(eq(schema.appointmentPhotos.id, photoId))
    .run();

  const firstRemaining = db
    .select({ url: schema.appointmentPhotos.url })
    .from(schema.appointmentPhotos)
    .where(
      and(
        eq(schema.appointmentPhotos.appointmentId, id),
        eq(schema.appointmentPhotos.kind, "final")
      )
    )
    .orderBy(schema.appointmentPhotos.position)
    .limit(1)
    .get();

  db.update(schema.appointments)
    .set({ finalPhotoUrl: firstRemaining?.url ?? null })
    .where(eq(schema.appointments.id, id))
    .run();

  logActivity(db, {
    entity: "appointments",
    action: "update",
    entityId: id,
    label: `Foto final eliminada de la cita`,
    metadata: { appointmentId: id, photoId, url: photo.url },
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });

  return NextResponse.json({ success: true });
}
