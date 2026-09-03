export const SALON_TZ = "America/Caracas";

export function todayStr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SALON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function dateToDayStartTs(date: string): number {
  return Math.floor(new Date(date + "T00:00:00-04:00").getTime() / 1000);
}

export function dateTimeToTs(date: string, time: string): number {
  return Math.floor(new Date(`${date}T${time}:00-04:00`).getTime() / 1000);
}

function getDatePartsInCaracas(d: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SALON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") === 24 ? 0 : get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function tsToLocalDateStr(ts: number): string {
  const { year, month, day } = getDatePartsInCaracas(new Date(ts * 1000));
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function tsToLocalHHMM(ts: number): string {
  const { hour, minute } = getDatePartsInCaracas(new Date(ts * 1000));
  return `${pad(hour)}:${pad(minute)}`;
}

export function tsToLocalLabel(ts: number): string {
  const { year, month, day, hour, minute } = getDatePartsInCaracas(
    new Date(ts * 1000)
  );
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}`;
}

export function dateTimeLocalToTs(date: string, time: string): number {
  return dateTimeToTs(date, time);
}