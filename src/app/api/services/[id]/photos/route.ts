import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";
import { logActivity } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await hasPermission(session, "services"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const service = db.select().from(schema.services).where(eq(schema.services.id, id)).get();
  if (!service) {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }
  const body = await req.json();
  const urls: string[] = Array.isArray(body?.urls)
    ? body.urls.filter((u: unknown): u is string => typeof u === "string" && u.length > 0)
    : [];
  const now = Math.floor(Date.now() / 1000);
  const existing = db
    .select({ position: schema.servicePhotos.position })
    .from(schema.servicePhotos)
    .where(eq(schema.servicePhotos.serviceId, id))
.all();
  let nextPos = existing.length ? Math.max(...existing.map((p) => p.position)) + 1 : 0;
  for (const url of urls) {
    const photo = { id: crypto.randomUUID(), serviceId: id, url, position: nextPos, createdAt: now };
    db.insert(schema.servicePhotos).values(photo).run();
    logActivity(db, {
      entity: "service_photos",
      action: "create",
      entityId: photo.id,
      label: "Foto agregada al servicio",
      metadata: { serviceId: id, position: photo.position },
      actorId: session?.user?.id,
      actorName: session?.user?.name ?? null,
    });
    nextPos += 1;
  }
  return NextResponse.json({ success: true });
}

