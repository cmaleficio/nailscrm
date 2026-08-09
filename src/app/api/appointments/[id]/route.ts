import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";
import {
  updateAppointmentEvent,
  getAdminUserId,
  deleteEventOnPrimaryCalendar,
} from "@/lib/calendar";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { status, startTime } = body;

  if (!status && typeof startTime !== "number") {
    return NextResponse.json(
      { error: "status or startTime is required" },
      { status: 400 }
    );
  }

  const appointment = db
    .select()
    .from(schema.appointments)
    .where(eq(schema.appointments.id, id))
    .get();

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  if (status === "cancelled" && (appointment.status === "completed" || appointment.status === "cancelled")) {
    return NextResponse.json(
      { error: "Esta cita ya no se puede cancelar" },
      { status: 400 }
    );
  }

  if (typeof startTime === "number" && startTime !== appointment.startTime) {
    const service = db
      .select()
      .from(schema.services)
      .where(eq(schema.services.id, appointment.serviceId))
      .get();

    const endTime =
      startTime + Math.floor((service?.durationMins ?? 60) * 60);

    db.update(schema.appointments)
      .set({ startTime, endTime })
      .where(eq(schema.appointments.id, id))
      .run();

    if (appointment.googleEventIdClient) {
      await updateAppointmentEvent(
        appointment.clientId,
        appointment.googleEventIdClient,
        startTime,
        endTime
      );
    }
    if (appointment.googleEventIdAdmin) {
      const adminUserId = await getAdminUserId();
      if (adminUserId) {
        await updateAppointmentEvent(
          adminUserId,
          appointment.googleEventIdAdmin,
          startTime,
          endTime
        );
      }
    }
  }

  if (status === "cancelled" && appointment.status !== "cancelled") {
    if (appointment.googleEventIdClient) {
      await deleteEventOnPrimaryCalendar(
        appointment.clientId,
        appointment.googleEventIdClient
      );
    }
    if (appointment.googleEventIdAdmin) {
      const adminUserId = await getAdminUserId();
      if (adminUserId) {
        await deleteEventOnPrimaryCalendar(
          adminUserId,
          appointment.googleEventIdAdmin
        );
      }
    }
  }

  if (status === "completed" && appointment.status !== "completed") {
    const client = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, appointment.clientId))
      .get();

    if (client) {
      const service = db
        .select()
        .from(schema.services)
        .where(eq(schema.services.id, appointment.serviceId))
        .get();

      db.update(schema.users)
        .set({
          totalVisits: (client.totalVisits ?? 0) + 1,
          totalRevenue: (client.totalRevenue ?? 0) + (service?.price ?? 0),
        })
        .where(eq(schema.users.id, client.id))
        .run();
    }

    const finalPhotos: string[] = Array.isArray(body.finalPhotos)
      ? body.finalPhotos.filter((u: unknown): u is string => typeof u === "string" && u.length > 0)
      : [];

    if (finalPhotos.length > 0) {
      const now = Math.floor(Date.now() / 1000);
      finalPhotos.forEach((url, i) => {
        db.insert(schema.appointmentPhotos)
          .values({
            id: crypto.randomUUID(),
            appointmentId: id,
            url,
            position: i,
            createdAt: now,
            kind: "final",
          })
          .run();
      });
      db.update(schema.appointments)
        .set({
          finalPhotoUrl: finalPhotos[0],
          sharedToGallery: 1,
        })
        .where(eq(schema.appointments.id, id))
        .run();
    }
  }

  if (status) {
    db.update(schema.appointments)
      .set({ status })
      .where(eq(schema.appointments.id, id))
      .run();
  }

  return NextResponse.json({ success: true });
}