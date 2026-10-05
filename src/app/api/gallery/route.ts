import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db/index";
import { like, sql, eq, and, or, desc, inArray } from "drizzle-orm";
import { summarizePurchases } from "@/lib/appointment-purchases";
import { publicFirstName } from "@/lib/public-name";

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

  let cursorTs: number | null = null;
  let cursorId: string | null = null;
  if (cursor) {
    const [ts, ...idParts] = cursor.split("_");
    cursorTs = Number(ts);
    cursorId = idParts.join("_");
  }

  // Fotos finales de citas compartidas
  const apConditions = [
    eq(schema.appointmentPhotos.kind, "final"),
    eq(schema.appointments.sharedToGallery, 1),
  ];
  if (filter) {
    apConditions.push(like(schema.services.name, `%${filter}%`));
  }
  if (cursorTs !== null && !Number.isNaN(cursorTs) && cursorId !== null) {
    apConditions.push(
      or(
        sql`${schema.appointmentPhotos.createdAt} < ${cursorTs}`,
        sql`(${schema.appointmentPhotos.createdAt} = ${cursorTs} AND ${schema.appointmentPhotos.id} < ${cursorId})`
      ) as ReturnType<typeof sql>
    );
  }

  const apRows = db
    .select({
      id: schema.appointmentPhotos.id,
      url: schema.appointmentPhotos.url,
      clientName: schema.users.name,
      serviceName: schema.services.name,
      serviceId: schema.services.id,
      appointmentId: schema.appointments.id,
      // Necesario para resolver los nombres de la combinación sin hacer
      // LEFT JOIN a service_purchases (que multiplicaría las filas).
      clientId: schema.users.id,
      createdAt: schema.appointmentPhotos.createdAt,
    })
    .from(schema.appointmentPhotos)
    .innerJoin(schema.appointments, eq(schema.appointmentPhotos.appointmentId, schema.appointments.id))
    .innerJoin(schema.users, eq(schema.appointments.clientId, schema.users.id))
    .innerJoin(schema.services, eq(schema.appointments.serviceId, schema.services.id))
    .where(and(...apConditions))
    .orderBy(desc(schema.appointmentPhotos.createdAt), desc(schema.appointmentPhotos.id))
    .limit(limit + 51)
    .all();

  // Nombres completos de los servicios de cada cita. Se resuelven aparte con
  // summarizePurchases porque un LEFT JOIN a service_purchases multiplicaría
  // cada foto por el número de compras (y rompería la paginación por cursor).
  const galleryNameByAppointment = new Map<string, string>();
  {
    const ids = [...new Set(apRows.map((r) => r.appointmentId))];
    if (ids.length > 0) {
      const purchaseRows = db
        .select({
          id: schema.servicePurchases.id,
          appointmentId: schema.servicePurchases.appointmentId,
          userId: schema.servicePurchases.userId,
          serviceName: schema.servicePurchases.serviceName,
          servicePrice: schema.servicePurchases.servicePrice,
          serviceDurationMins: schema.servicePurchases.serviceDurationMins,
          isPrimary: schema.servicePurchases.isPrimary,
        })
        .from(schema.servicePurchases)
        .where(inArray(schema.servicePurchases.appointmentId, ids))
        .all();

      // Una fila por cita, no por foto: summarizePurchases espera citas.
      const appts = [
        ...new Map(
          apRows.map((r) => [
            r.appointmentId,
            {
              id: r.appointmentId,
              clientId: r.clientId,
              serviceName: r.serviceName,
            },
          ])
        ).values(),
      ];
      for (const [aid, s] of summarizePurchases(appts, purchaseRows)) {
        if (s.serviceName) galleryNameByAppointment.set(aid, s.serviceName);
      }
    }
  }

  // Fotos sueltas subidas por el admin (pre-llenado del muro)
  const gpConditions = [];
  if (filter) {
    gpConditions.push(like(schema.services.name, `%${filter}%`));
  }
  if (cursorTs !== null && !Number.isNaN(cursorTs) && cursorId !== null) {
    gpConditions.push(
      or(
        sql`${schema.galleryPhotos.createdAt} < ${cursorTs}`,
        sql`(${schema.galleryPhotos.createdAt} = ${cursorTs} AND ${schema.galleryPhotos.id} < ${cursorId})`
      ) as ReturnType<typeof sql>
    );
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
    .orderBy(desc(schema.galleryPhotos.createdAt), desc(schema.galleryPhotos.id))
    .limit(limit + 51)
    .all();

  const merged: GalleryItem[] = [
    ...apRows.map((r) => ({
      id: `ap_${r.id}`,
      url: r.url ?? "/placeholder.svg",
      // El muro es público y sin sesión: sale el nombre de pila, no el completo.
      // El truncado es del servidor a propósito (ver `publicFirstName`).
      clientName: publicFirstName(r.clientName),
      serviceName: galleryNameByAppointment.get(r.appointmentId) ?? r.serviceName,
      serviceId: r.serviceId,
      appointmentId: r.appointmentId,
      createdAt: r.createdAt,
    })),
    ...gpRows.map((r) => ({
      id: `gp_${r.id}`,
      url: r.url,
      clientName: null,
      serviceName: r.serviceName,
      serviceId: r.serviceId,
      appointmentId: null,
      createdAt: r.createdAt,
    })),
  ].sort((a, b) => {
    const tsDiff = (b.createdAt ?? 0) - (a.createdAt ?? 0);
    if (tsDiff !== 0) return tsDiff;
    return a.id.localeCompare(b.id);
  });

  const page = merged.slice(0, limit + 1);
  const hasMore = page.length > limit;
  const items = page.slice(0, limit);
  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem
    ? `${lastItem.createdAt}_${lastItem.id.replace(/^(ap_|gp_)/, "")}`
    : null;

  return NextResponse.json({ items, nextCursor, hasMore });
}
