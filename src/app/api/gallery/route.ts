import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db/index";
import { like, sql, eq, and } from "drizzle-orm";

type GalleryItem = {
  id: string;
  url: string;
  clientName: string | null;
  serviceName: string | null;
  serviceId: string | null;
  appointmentId: string | null;
  createdAt: number | null;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const filter = searchParams.get("filter") || "";
  const limit = Math.min(Number(searchParams.get("limit")) || 10, 50);

  const cursorTs = cursor ? Number(cursor) : null;

  // Fotos finales de citas compartidas
  const apConditions = [
    eq(schema.appointmentPhotos.kind, "final"),
    eq(schema.appointments.sharedToGallery, 1),
  ];
  if (filter) {
    apConditions.push(like(schema.services.name, `%${filter}%`));
  }
  if (cursorTs !== null && !Number.isNaN(cursorTs)) {
    apConditions.push(sql`${schema.appointmentPhotos.createdAt} < ${cursorTs}`);
  }

  const apRows = db
    .select({
      id: schema.appointmentPhotos.id,
      url: schema.appointmentPhotos.url,
      clientName: schema.users.name,
      serviceName: schema.services.name,
      serviceId: schema.services.id,
      appointmentId: schema.appointments.id,
      createdAt: schema.appointmentPhotos.createdAt,
    })
    .from(schema.appointmentPhotos)
    .innerJoin(schema.appointments, eq(schema.appointmentPhotos.appointmentId, schema.appointments.id))
    .innerJoin(schema.users, eq(schema.appointments.clientId, schema.users.id))
    .innerJoin(schema.services, eq(schema.appointments.serviceId, schema.services.id))
    .where(and(...apConditions))
    .limit(limit + 51)
    .all();

  // Fotos sueltas subidas por el admin (pre-llenado del muro)
  const gpConditions = [];
  if (filter) {
    gpConditions.push(like(schema.services.name, `%${filter}%`));
  }
  if (cursorTs !== null && !Number.isNaN(cursorTs)) {
    gpConditions.push(sql`${schema.galleryPhotos.createdAt} < ${cursorTs}`);
  }

  const gpRows = db
    .select({
      id: schema.galleryPhotos.id,
      url: schema.galleryPhotos.url,
      serviceName: schema.services.name,
      serviceId: schema.galleryPhotos.serviceId,
      createdAt: schema.galleryPhotos.createdAt,
    })
    .from(schema.galleryPhotos)
    .leftJoin(schema.services, eq(schema.galleryPhotos.serviceId, schema.services.id))
    .where(gpConditions.length ? and(...gpConditions) : undefined)
    .limit(limit + 51)
    .all();

  const merged: GalleryItem[] = [
    ...apRows.map((r) => ({
      id: r.id,
      url: r.url ?? "/placeholder.svg",
      clientName: r.clientName,
      serviceName: r.serviceName,
      serviceId: r.serviceId,
      appointmentId: r.appointmentId,
      createdAt: r.createdAt,
    })),
    ...gpRows.map((r) => ({
      id: r.id,
      url: r.url,
      clientName: null,
      serviceName: r.serviceName,
      serviceId: r.serviceId,
      appointmentId: null,
      createdAt: r.createdAt,
    })),
  ]
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  const page = merged.slice(0, limit + 1);
  const hasMore = page.length > limit;
  const items = page.slice(0, limit).map(({ ...r }) => r);
  const nextCursor = hasMore ? String(items[items.length - 1]?.createdAt ?? "") : null;

  return NextResponse.json({ items, nextCursor, hasMore });
}
