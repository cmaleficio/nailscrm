import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { deleteEventOnPrimaryCalendar, getAdminUserId } from "@/lib/calendar";

export async function POST(
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

  if (appointment.clientId !== session.user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (appointment.status === "completed" || appointment.status === "cancelled") {
    return NextResponse.json(
      { error: "Esta cita ya no se puede cancelar" },
      { status: 400 }
    );
  }

  db.update(schema.appointments)
    .set({ status: "cancelled" })
    .where(eq(schema.appointments.id, id))
    .run();

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

  return NextResponse.json({ success: true });
}