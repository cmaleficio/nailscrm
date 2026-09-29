import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";
import {
  parseProductionFilters,
  groupPhotosByDay,
  buildProductionCaption,
  dayKeyFromTimestamp,
  escapeLikePattern,
} from "@/lib/production-photos";

/**
 * Días por página. Se pagina por DÍA, no por foto: devolver un día entero
 * mantiene los encabezados de fecha exactos y evita que una cita quede partida
 * entre dos páginas. Un día del salón son unas pocas fotos, así que el tamaño
 * real de cada página queda acotado de todos modos.
 */
const DEFAULT_DAYS = 14;

/**
 * Clave del día del salón calculada en SQL para poder filtrar y paginar por
 * ella. Venezuela es UTC-4 fijo (el horario de verano se abolió en 2016), así
 * que el desplazamiento es una constante y no hace falta una tabla de zonas.
 * Tiene que coincidir con `dayKeyFromTimestamp` de src/lib/production-photos.
 */
const dayKey = sql<string>`strftime('%Y-%m-%d', ${schema.appointments.startTime}, 'unixepoch', '-4 hours')`;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await hasPermission(session, "gallery"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const { from, to, before, serviceId, q } = parseProductionFilters(searchParams);
  const days = Math.min(
    Math.max(Number(searchParams.get("days")) || DEFAULT_DAYS, 1),
    60
  );

  const conditions: SQL[] = [
    eq(schema.appointmentPhotos.kind, "final"),
    eq(schema.appointments.status, "completed"),
  ];
  if (from) conditions.push(sql`${dayKey} >= ${from}`);
  if (to) conditions.push(sql`${dayKey} <= ${to}`);
  // El cursor es exclusivo: la página siguiente arranca el día después del
  // último devuelto, así que no se repite ni se salta ninguna foto.
  if (before) conditions.push(sql`${dayKey} < ${before}`);
  if (serviceId) conditions.push(eq(schema.appointments.serviceId, serviceId));
  if (q) {
    // `\\` en el template de JS produce una barra invertida real en el SQL;
    // escribir `'\'` a mano llegaría a SQLite como cadena vacía y SQLite
    // rechazaría la consulta ("ESCAPE expression must be a single character").
    conditions.push(
      sql`fold(${schema.users.name}) LIKE ${`%${escapeLikePattern(q)}%`} ESCAPE '\\'`
    );
  }
  const where = and(...conditions)!;

  // Primera pasada: los días distintos que tocan. Se piden uno de más para
  // saber si hay página siguiente sin una consulta de conteo aparte.
  const dayRows = db
    .select({ date: dayKey })
    .from(schema.appointmentPhotos)
    .innerJoin(
      schema.appointments,
      eq(schema.appointmentPhotos.appointmentId, schema.appointments.id)
    )
    .innerJoin(schema.users, eq(schema.appointments.clientId, schema.users.id))
    .innerJoin(
      schema.services,
      eq(schema.appointments.serviceId, schema.services.id)
    )
    .where(where)
    .groupBy(dayKey)
    .orderBy(sql`${dayKey} DESC`)
    .limit(days + 1)
    .all();

  const hasMore = dayRows.length > days;
  const pageDays = dayRows.slice(0, days).map((row) => row.date);
  if (pageDays.length === 0) {
    return NextResponse.json({ days: [], nextCursor: null, hasMore: false });
  }

  // Segunda pasada: las fotos de esos días, en el mismo orden que las devuelve
  // la agrupación del cliente.
  const dayList = sql.join(pageDays.map((date) => sql`${date}`), sql`, `);
  const photoRows = db
    .select({
      id: schema.appointmentPhotos.id,
      url: schema.appointmentPhotos.url,
      startTime: schema.appointments.startTime,
      clientId: schema.users.id,
      clientName: schema.users.name,
      serviceId: schema.services.id,
      serviceName: schema.services.name,
    })
    .from(schema.appointmentPhotos)
    .innerJoin(
      schema.appointments,
      eq(schema.appointmentPhotos.appointmentId, schema.appointments.id)
    )
    .innerJoin(schema.users, eq(schema.appointments.clientId, schema.users.id))
    .innerJoin(
      schema.services,
      eq(schema.appointments.serviceId, schema.services.id)
    )
    .where(and(where, sql`${dayKey} IN (${dayList})`))
    .orderBy(
      sql`${dayKey} DESC`,
      schema.appointments.startTime,
      schema.appointmentPhotos.position
    )
    .all();

  // Una cita completada sin hora de inicio no tiene día al que pertenecer, así
  // que se queda fuera del archivo en vez de aparecer sin encabezado.
  const photos = photoRows.flatMap((row) => {
    if (row.startTime === null) return [];
    return [
      {
        ...row,
        date: dayKeyFromTimestamp(row.startTime),
        caption: buildProductionCaption({
          serviceName: row.serviceName,
          clientName: row.clientName,
          startTime: row.startTime,
        }),
      },
    ];
  });

  return NextResponse.json({
    days: groupPhotosByDay(photos),
    nextCursor: hasMore ? pageDays[pageDays.length - 1] : null,
    hasMore,
  });
}
