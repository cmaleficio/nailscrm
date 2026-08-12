import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, desc, inArray } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";

export async function GET() {
  const session = await auth();
  if (!(await hasPermission(session, "appointments"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rows = db
    .select({
      id: schema.cancelledAppointments.id,
      appointmentId: schema.cancelledAppointments.appointmentId,
      clientId: schema.cancelledAppointments.clientId,
      serviceName: schema.cancelledAppointments.serviceName,
      servicePrice: schema.cancelledAppointments.servicePrice,
      startTime: schema.cancelledAppointments.startTime,
      endTime: schema.cancelledAppointments.endTime,
      referencePhotoUrls: schema.cancelledAppointments.referencePhotoUrls,
      cancelledBy: schema.cancelledAppointments.cancelledBy,
      cancelledAt: schema.cancelledAppointments.cancelledAt,
      reason: schema.cancelledAppointments.reason,
      clientName: schema.users.name,
    })
    .from(schema.cancelledAppointments)
    .innerJoin(
      schema.users,
      eq(schema.cancelledAppointments.clientId, schema.users.id)
    )
    .orderBy(desc(schema.cancelledAppointments.cancelledAt))
    .all();

  const actorIds = Array.from(new Set(rows.map((r) => r.cancelledBy)));
  const roleRows =
    actorIds.length > 0
      ? db
          .select({ id: schema.users.id, role: schema.users.role })
          .from(schema.users)
          .where(inArray(schema.users.id, actorIds))
          .all()
      : [];
  const roleMap = new Map(roleRows.map((u) => [u.id, u.role]));

  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      actorRole: roleMap.get(r.cancelledBy) ?? "client",
      referencePhotoUrls: r.referencePhotoUrls
        ? (() => {
            try {
              return JSON.parse(r.referencePhotoUrls);
            } catch {
              return [];
            }
          })()
        : [],
    }))
  );
}
