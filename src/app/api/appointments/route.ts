import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { serviceId, startTime, referencePhotoUrl } = body;

  if (!serviceId || !startTime) {
    return NextResponse.json(
      { error: "serviceId and startTime are required" },
      { status: 400 }
    );
  }

  const service = db
    .select()
    .from(schema.services)
    .where(eq(schema.services.id, serviceId))
    .get();

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const endTime = startTime + service.durationMins * 60;
  const now = Math.floor(Date.now() / 1000);

  const appointment = {
    id: crypto.randomUUID(),
    clientId: session.user.id,
    serviceId,
    startTime,
    endTime,
    status: "pending",
    referencePhotoUrl: referencePhotoUrl || null,
    createdAt: now,
  };

  db.insert(schema.appointments).values(appointment).run();

  const existingUser = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.user.id))
    .get();

  if (existingUser) {
    db.update(schema.users)
      .set({ totalVisits: (existingUser.totalVisits ?? 0) + 1 })
      .where(eq(schema.users.id, session.user.id))
      .run();
  }

  return NextResponse.json({ id: appointment.id });
}
