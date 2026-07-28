export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "long",
    timeZone: "America/Caracas",
  }).format(new Date(timestamp * 1000));
}

export function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeStyle: "short",
    timeZone: "America/Caracas",
  }).format(new Date(timestamp * 1000));
}
