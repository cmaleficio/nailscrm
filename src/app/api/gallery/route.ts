import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db/index";
import { like, sql, eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const filter = searchParams.get("filter") || "";
  const limit = Math.min(Number(searchParams.get("limit")) || 10, 50);

  const conditions = [
    eq(schema.appointmentPhotos.kind, "final"),
    eq(schema.appointments.sharedToGallery, 1),
  ];

  if (filter) {
    conditions.push(like(schema.services.name, `%${filter}%`));
  }

  if (cursor) {
    conditions.push(sql`${schema.appointmentPhotos.createdAt} < ${Number(cursor)}`);
  }

  const rows = db
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
    .where(and(...conditions))
    .orderBy(sql`${schema.appointmentPhotos.createdAt} DESC`)
    .limit(limit + 1)
    .all();

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map((r) => ({
    id: r.id,
    url: r.url ?? "/placeholder.svg",
    clientName: r.clientName,
    serviceName: r.serviceName,
    serviceId: r.serviceId,
    appointmentId: r.appointmentId,
  }));
  const nextCursor = hasMore ? String(rows[limit - 1]?.createdAt ?? "") : null;

  return NextResponse.json({ items, nextCursor, hasMore });
}
