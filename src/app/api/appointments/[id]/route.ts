import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { status } = body;

  if (!status) {
    return NextResponse.json({ error: "status is required" }, { status: 400 });
  }

  const appointment = db
    .select()
    .from(schema.appointments)
    .where(eq(schema.appointments.id, id))
    .get();

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
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
  }

  db.update(schema.appointments)
    .set({ status })
    .where(eq(schema.appointments.id, id))
    .run();

  return NextResponse.json({ success: true });
}
