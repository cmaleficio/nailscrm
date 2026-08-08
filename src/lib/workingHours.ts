import { db, schema } from "@/db/index";
import { dateToDayStartTs } from "@/lib/time";

export type WorkingHoursRow = {
  dayOfWeek: number;
  isOpen: boolean;
  startTime: string;
  endTime: string;
};

export const DEFAULT_WORKING_HOURS: WorkingHoursRow[] = Array.from(
  { length: 7 },
  (_, dayOfWeek) => ({
    dayOfWeek,
    isOpen: dayOfWeek !== 0,
    startTime: "09:00",
    endTime: "18:00",
  })
);

export function parseHhMm(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function getWorkingHoursAll(): WorkingHoursRow[] {
  const rows = db.select().from(schema.workingHours).all();
  const byDay = new Map<number, WorkingHoursRow>();
  for (const r of rows) {
    byDay.set(r.dayOfWeek, {
      dayOfWeek: r.dayOfWeek,
      isOpen: r.isOpen === 1,
      startTime: r.startTime,
      endTime: r.endTime,
    });
  }
  return DEFAULT_WORKING_HOURS.map((d) => byDay.get(d.dayOfWeek) ?? d);
}

export function getWorkingHoursForDate(date: string): {
  isOpen: boolean;
  openMin: number;
  closeMin: number;
} {
  const day = new Date(dateToDayStartTs(date) * 1000).getDay();
  const row = getWorkingHoursAll()[day];
  if (!row || !row.isOpen) return { isOpen: false, openMin: 0, closeMin: 0 };
  return {
    isOpen: true,
    openMin: parseHhMm(row.startTime),
    closeMin: parseHhMm(row.endTime),
  };
}
