import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db/index";
import { eq, and, gte, lt, sql } from "drizzle-orm";
import { generateSlots } from "@/lib/slots";
import { getWorkingHoursForDate } from "@/lib/workingHours";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const serviceId = searchParams.get("serviceId");

  if (!date || !serviceId) {
    return NextResponse.json(
      { error: "date and serviceId are required" },
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

  const dateObj = new Date(date + "T00:00:00-04:00");
  const dayStart = Math.floor(dateObj.getTime() / 1000);
  const dayEnd = dayStart + 24 * 3600;

  const rawAppointments = db
    .select({
      startTime: schema.appointments.startTime,
      endTime: schema.appointments.endTime,
    })
    .from(schema.appointments)
    .where(
      and(
        gte(schema.appointments.startTime, dayStart),
        lt(schema.appointments.startTime, dayEnd),
        sql`${schema.appointments.status} IN ('pending', 'confirmed')`
      )
    )
    .all();

  const existingAppointments = rawAppointments.filter(
    (a): a is { startTime: number; endTime: number } =>
      a.startTime !== null && a.endTime !== null
  );

  const rawBlockouts = db
    .select({
      startTime: schema.blockouts.startTime,
      endTime: schema.blockouts.endTime,
    })
    .from(schema.blockouts)
    .where(
      and(
        gte(schema.blockouts.startTime, dayStart),
        lt(schema.blockouts.startTime, dayEnd)
      )
    )
    .all();

  const blockouts = rawBlockouts.filter(
    (b): b is { startTime: number; endTime: number } =>
      b.startTime !== null && b.endTime !== null
  );

  const { isOpen, openMin, closeMin } = getWorkingHoursForDate(date);

  const slots = isOpen
    ? generateSlots({
        date,
        durationMins: service.durationMins,
        existingAppointments,
        blockouts,
        openMin,
        closeMin,
      })
    : [];

  return NextResponse.json({
    slots,
    durationMins: service.durationMins,
    openTime: isOpen
      ? `${String(Math.floor(openMin / 60)).padStart(2, "0")}:${String(openMin % 60).padStart(2, "0")}`
      : null,
    closeTime: isOpen
      ? `${String(Math.floor(closeMin / 60)).padStart(2, "0")}:${String(closeMin % 60).padStart(2, "0")}`
      : null,
  });
}
