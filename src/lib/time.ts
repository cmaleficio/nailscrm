export function todayStr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
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
