import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, desc } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

export async function GET() {
  const session = await auth();
  if (!(await isAdmin(session))) {
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

  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      referencePhotoUrls: r.referencePhotoUrls
        ? JSON.parse(r.referencePhotoUrls)
        : [],
    }))
  );
}
