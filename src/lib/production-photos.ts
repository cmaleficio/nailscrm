export const SALON_TIME_ZONE = "America/Caracas";

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const dayKeyFormatters = new Map<string, Intl.DateTimeFormat>();

function dayKeyFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = dayKeyFormatters.get(timeZone);
  if (!formatter) {
    // en-CA rinde YYYY-MM-DD, que es justo la clave que compara el cursor.
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayKeyFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * Plegado de acentos para buscar sin tildes. Se registra además como función
 * de SQLite (ver src/db/index.ts) porque LIKE no ignora diacríticos por su
 * cuenta, y el filtro de clienta va en SQL para no romper la paginación por día.
 */
export function foldSearchText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Día calendario del salón (YYYY-MM-DD) en el que cae un timestamp unix. */
export function dayKeyFromTimestamp(
  timestamp: number,
  timeZone: string = SALON_TIME_ZONE
): string {
  return dayKeyFormatter(timeZone).format(new Date(timestamp * 1000));
}

/**
 * Escapa los comodines de LIKE para que el texto buscado sea literal. Sin esto,
 * teclear "%" en el buscador devolvería el archivo entero.
 * Usar siempre junto a `... LIKE ? ESCAPE '\'`.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function isDayKey(value: string | null | undefined): value is string {  if (!value || !DAY_KEY_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Etiqueta legible de una clave de día. Se interpreta a medianoche UTC a
 * propósito: la clave ya expresa el día del salón, así que formatearla en hora
 * local la correría un día hacia atrás.
 */
export function dayLabelFromKey(dayKey: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${dayKey}T00:00:00Z`));
}

export type ProductionDay<T> = {
  date: string;
  label: string;
  count: number;
  photos: T[];
};

/**
 * Agrupa fotos por día del salón conservando el orden de entrada dentro de cada
 * día, y ordena los días del más reciente al más antiguo. No muta la entrada.
 */
export function groupPhotosByDay<T extends { startTime: number | null }>(
  photos: T[],
  timeZone: string = SALON_TIME_ZONE
): ProductionDay<T>[] {
  const byDate = new Map<string, T[]>();
  for (const photo of photos) {
    if (photo.startTime === null) continue;
    const key = dayKeyFromTimestamp(photo.startTime, timeZone);
    const bucket = byDate.get(key);
    if (bucket) bucket.push(photo);
    else byDate.set(key, [photo]);
  }

  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([date, group]) => ({
      date,
      label: dayLabelFromKey(date),
      count: group.length,
      photos: group,
    }));
}

/** Pie del visor y base del nombre de descarga: "Gel · Ana · 12 ene 2026". */
export function buildProductionCaption({
  serviceName,
  clientName,
  startTime,
  timeZone = SALON_TIME_ZONE,
}: {
  serviceName: string | null;
  clientName: string | null;
  startTime: number | null;
  timeZone?: string;
}): string {
  const date =
    startTime === null
      ? null
      : new Intl.DateTimeFormat("es-ES", {
          dateStyle: "medium",
          timeZone,
        }).format(new Date(startTime * 1000));
  return [serviceName, clientName, date].filter(Boolean).join(" · ");
}

export type ProductionFilters = {
  from: string | null;
  to: string | null;
  before: string | null;
  serviceId: string | null;
  q: string;
};

/**
 * Normaliza los query params del archivo de producción. Las fechas imposibles
 * se descartan en silencio en vez de romper: son valores de inputs de fecha del
 * navegador y uno raro no debería tumbar la página.
 */
export function parseProductionFilters(
  searchParams: URLSearchParams
): ProductionFilters {
  const rawFrom = searchParams.get("from");
  const rawTo = searchParams.get("to");
  const rawBefore = searchParams.get("before");

  return {
    from: isDayKey(rawFrom) ? rawFrom : null,
    to: isDayKey(rawTo) ? rawTo : null,
    before: isDayKey(rawBefore) ? rawBefore : null,
    serviceId: searchParams.get("serviceId")?.trim() || null,
    q: foldSearchText(searchParams.get("q")),
  };
}
