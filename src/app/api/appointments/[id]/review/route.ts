import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";

function firstName(fullName: string | null): string {
  return fullName?.trim().split(/\s+/)[0] ?? "";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const row = db
    .select({
      serviceName: schema.services.name,
      startTime: schema.appointments.startTime,
      status: schema.appointments.status,
      clientName: schema.users.name,
      reviewRating: schema.appointments.reviewRating,
      reviewText: schema.appointments.reviewText,
    })
    .from(schema.appointments)
    .innerJoin(schema.users, eq(schema.appointments.clientId, schema.users.id))
    .innerJoin(schema.services, eq(schema.appointments.serviceId, schema.services.id))
    .where(eq(schema.appointments.id, id))
    .get();

  if (!row) {
    return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    serviceName: row.serviceName,
    startTime: row.startTime,
    status: row.status,
    clientFirstName: firstName(row.clientName),
    review:
      row.reviewRating != null
        ? { rating: row.reviewRating, text: row.reviewText }
        : null,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const rating = body?.rating;
  if (!Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5) {
    return NextResponse.json(
      { error: "La calificación debe ser un número entre 1 y 5" },
      { status: 400 }
    );
  }

  const text =
    typeof body?.text === "string" && body.text.trim()
      ? body.text.trim().slice(0, 500)
      : null;

  const appointment = db
    .select({
      id: schema.appointments.id,
      status: schema.appointments.status,
      reviewRating: schema.appointments.reviewRating,
    })
    .from(schema.appointments)
    .where(eq(schema.appointments.id, id))
    .get();

  if (!appointment) {
    return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
  }
  if (appointment.status !== "completed") {
    return NextResponse.json(
      { error: "Solo se pueden reseñar citas completadas" },
      { status: 400 }
    );
  }
  if (appointment.reviewRating != null) {
    return NextResponse.json(
      { error: "Esta cita ya tiene una reseña" },
      { status: 409 }
    );
  }

  db.update(schema.appointments)
    .set({ reviewRating: rating as number, reviewText: text })
    .where(eq(schema.appointments.id, id))
    .run();

  return NextResponse.json({ success: true });
}
