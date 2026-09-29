import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db/index";
import { eq, and, gte, lt, sql, inArray } from "drizzle-orm";
import { generateSlots, maxContiguousMins } from "@/lib/slots";
import { getWorkingHoursForDate } from "@/lib/workingHours";
import { parseComplementaryIds } from "@/lib/booking-combos";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const serviceId = searchParams.get("serviceId");
  const addServiceIds = parseComplementaryIds(searchParams.getAll("addServiceIds"));

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

  // Los complementarios no suman servicios; solo duración y nombres para la UI.
  // Su validación de rol (activo, marcado complementario, no curso) vive en
  // resolveBookingServices, que se ejecuta al crear la cita.
  let extraDurationMins = 0;
  let serviceNames = [service.name];
  if (addServiceIds.length > 0) {
    const extras = db
      .select({ name: schema.services.name, durationMins: schema.services.durationMins })
      .from(schema.services)
      .where(inArray(schema.services.id, addServiceIds))
      .all();
    extraDurationMins = extras.reduce((acc, s) => acc + s.durationMins, 0);
    serviceNames = [service.name, ...extras.map((s) => s.name)];
  }

  const durationMins = service.durationMins + extraDurationMins;

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

  const slotInput = {
    date,
    durationMins,
    existingAppointments,
    blockouts,
    openMin,
    closeMin,
  };

  const slots = isOpen ? generateSlots(slotInput) : [];

  // Con el día cerrado no hay nada que esperar, así que el hueco máximo es 0
  // y la UI no debe ofrecer lista de espera por capacidad de un día no laborable.
  const maxMins = isOpen ? maxContiguousMins(slotInput) : 0;

  return NextResponse.json({
    slots,
    durationMins,
    serviceNames,
    hasAvailability: slots.some((s) => s.available),
    // Permite a la UI distinguir "no cabe esta combinación" de "el día está lleno":
    // maxMins >= durationMins siempre que hasAvailability sea true.
    maxContiguousMins: maxMins,
    openTime: isOpen
      ? `${String(Math.floor(openMin / 60)).padStart(2, "0")}:${String(openMin % 60).padStart(2, "0")}`
      : null,
    closeTime: isOpen
      ? `${String(Math.floor(closeMin / 60)).padStart(2, "0")}:${String(closeMin % 60).padStart(2, "0")}`
      : null,
  });
}
