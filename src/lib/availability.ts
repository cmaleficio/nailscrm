import { db, schema } from "@/db/index";
import { and, gte, lt, sql } from "drizzle-orm";
import { getWorkingHoursForDate } from "@/lib/workingHours";
import { dateToDayStartTs } from "@/lib/time";

export function getOverlappingAppointments(
  startTime: number,
  endTime: number
): { startTime: number; endTime: number }[] {
  return db
    .select({
      startTime: schema.appointments.startTime,
      endTime: schema.appointments.endTime,
    })
    .from(schema.appointments)
    .where(
      and(
        sql`${schema.appointments.status} IN ('pending', 'confirmed')`,
        lt(schema.appointments.startTime, endTime),
        gte(schema.appointments.endTime, startTime)
      )
    )
    .all()
    .filter(
      (a): a is { startTime: number; endTime: number } =>
        a.startTime !== null && a.endTime !== null
    );
}

export function getOverlappingBlockouts(
  startTime: number,
  endTime: number
): { startTime: number; endTime: number }[] {
  return db
    .select({
      startTime: schema.blockouts.startTime,
      endTime: schema.blockouts.endTime,
    })
    .from(schema.blockouts)
    .where(and(lt(schema.blockouts.startTime, endTime), gte(schema.blockouts.endTime, startTime)))
    .all()
    .filter(
      (b): b is { startTime: number; endTime: number } =>
        b.startTime !== null && b.endTime !== null
    );
}

export function validateSlot(startTime: number, endTime: number): string | null {
  if (startTime <= Math.floor(Date.now() / 1000)) {
    return "No puedes reservar en el pasado";
  }
  const date = new Date(startTime * 1000).toLocaleDateString("en-CA", {
    timeZone: "America/Caracas",
  });
  const { isOpen, openMin, closeMin } = getWorkingHoursForDate(date);
  if (!isOpen) return "El salón está cerrado ese día";
  const dayStart = dateToDayStartTs(date);
  const startMin = (startTime - dayStart) / 60;
  const endMin = (endTime - dayStart) / 60;
  if (startMin < openMin || endMin > closeMin) {
    return "El horario está fuera del horario de trabajo";
  }
  if (getOverlappingAppointments(startTime, endTime).length > 0) {
    return "Ese horario ya está ocupado";
  }
  if (getOverlappingBlockouts(startTime, endTime).length > 0) {
    return "Ese horario está bloqueado";
  }
  return null;
}
