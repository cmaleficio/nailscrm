import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
 import { db, schema } from "@/db/index";
 import { and, eq, isNull } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";
import {
  updateAppointmentEvent,
  getAdminUserId,
  deleteEventOnPrimaryCalendar,
} from "@/lib/calendar";
import { recordUsage } from "@/lib/inventory";
import { recomputeFinancialStatus } from "@/lib/financial-status";

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

  if (status === "cancelled") {
    return NextResponse.json(
      { error: "Usa el método DELETE para cancelar citas" },
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

  if (status === "completed" && appointment.status !== "completed") {
    const client = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, appointment.clientId))
      .get();

    if (client) {
      db.update(schema.users)
        .set({
          totalVisits: (client.totalVisits ?? 0) + 1,
        })
        .where(eq(schema.users.id, client.id))
        .run();
    }

    const now = Math.floor(Date.now() / 1000);
    db.update(schema.servicePurchases)
      .set({ completionDate: now })
      .where(and(eq(schema.servicePurchases.appointmentId, id), isNull(schema.servicePurchases.completionDate)))
      .run();
    if (client) {
      recomputeFinancialStatus(client.id);
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

    const usage: { inventoryItemId: string; quantity: number }[] = Array.isArray(body.usage)
      ? body.usage
          .filter((x: unknown) => x && typeof (x as { inventoryItemId?: unknown }).inventoryItemId === "string")
          .map((x: unknown) => ({
            inventoryItemId: (x as { inventoryItemId: string }).inventoryItemId,
            quantity: Number((x as { quantity?: unknown }).quantity) || 1,
          }))
      : [];
    if (usage.length > 0) {
      recordUsage(id, usage, session?.user?.id ?? "");
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const appointment = db
    .select()
    .from(schema.appointments)
    .where(eq(schema.appointments.id, id))
    .get();

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  const admin = await isAdmin(session);
  if (!admin && appointment.clientId !== session.user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (appointment.status === "completed") {
    return NextResponse.json(
      { error: "No se puede cancelar una cita completada" },
      { status: 400 }
    );
  }

  const purchase = db
    .select()
    .from(schema.servicePurchases)
    .where(eq(schema.servicePurchases.appointmentId, id))
    .get();

  const photos = db
    .select({ url: schema.appointmentPhotos.url })
    .from(schema.appointmentPhotos)
    .where(eq(schema.appointmentPhotos.appointmentId, id))
    .all();

  const service = db
    .select()
    .from(schema.services)
    .where(eq(schema.services.id, appointment.serviceId))
    .get();

  const purchaseRows = db
    .select({ userId: schema.servicePurchases.userId })
    .from(schema.servicePurchases)
    .where(eq(schema.servicePurchases.appointmentId, id))
    .all();

  db.transaction((tx) => {
    tx.insert(schema.cancelledAppointments)
      .values({
        id: crypto.randomUUID(),
        appointmentId: appointment.id,
        clientId: appointment.clientId,
        serviceId: appointment.serviceId,
        serviceName: purchase?.serviceName ?? service?.name ?? "",
        servicePrice: purchase?.servicePrice ?? service?.price ?? 0,
        startTime: appointment.startTime ?? null,
        endTime: appointment.endTime ?? null,
        referencePhotoUrls: photos.length
          ? JSON.stringify(photos.map((p) => p.url))
          : null,
        cancelledBy: session.user.id,
        cancelledAt: Math.floor(Date.now() / 1000),
        reason: null,
      })
      .run();

    tx.update(schema.servicePurchases)
      .set({ financialStatus: "void" })
      .where(eq(schema.servicePurchases.appointmentId, id))
      .run();

    tx.delete(schema.appointments)
      .where(eq(schema.appointments.id, id))
      .run();
  });

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

  for (const p of purchaseRows) recomputeFinancialStatus(p.userId);

  return NextResponse.json({ success: true, deleted: true });
}
