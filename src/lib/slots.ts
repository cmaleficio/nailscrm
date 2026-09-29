export type SlotTime = {
  hour: number;
  minute: number;
  label: string;
  available: boolean;
};

export type SlotInput = {
  date: string;
  durationMins: number;
  existingAppointments: { startTime: number; endTime: number }[];
  blockouts: { startTime: number; endTime: number }[];
  openMin: number;
  closeMin: number;
};

const STEP = 15;

function overlaps(
  start: number,
  end: number,
  windows: { startTime: number; endTime: number }[]
): boolean {
  return windows.some((w) => start < w.endTime && end > w.startTime);
}

export function generateSlots(input: SlotInput): SlotTime[] {
  const { date, durationMins, existingAppointments, blockouts, openMin, closeMin } = input;

  const dateObj = new Date(date + "T00:00:00-04:00");
  const dayStart = Math.floor(dateObj.getTime() / 1000);

  const slots: SlotTime[] = [];

  const now = Math.floor(Date.now() / 1000);
  const step = STEP;
  for (let m = openMin; m + durationMins <= closeMin; m += step) {
    const slotStart = dayStart + m * 60;
    const slotEnd = slotStart + durationMins * 60;

    const overlapsAppointment = overlaps(
      slotStart,
      slotEnd,
      existingAppointments
    );

    const overlapsBlockout = overlaps(slotStart, slotEnd, blockouts);

    const isPast = slotStart <= now;

    const hour = Math.floor(m / 60);
    const minute = m % 60;
    slots.push({
      hour,
      minute,
      label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      available: !overlapsAppointment && !overlapsBlockout && !isPast,
    });
  }

  return slots;
}

/**
 * Mayor bloque corrido libre del día, en minutos.
 *
 * Reusa el MISMO predicado de solapamiento que generateSlots, así que por
 * construcción es la máxima duración que el grid reportaría como disponible.
 * Existe para distinguir dos estados que hoy la UI reporta igual:
 *  - el día está lleno (no cabe ni el servicio más corto) -> lista de espera;
 *  - la combinación no cabe (sí cabe algo, pero no la suma) -> quitar servicios.
 */
export function maxContiguousMins(input: SlotInput): number {
  const { date, existingAppointments, blockouts, openMin, closeMin } = input;

  const dateObj = new Date(date + "T00:00:00-04:00");
  const dayStart = Math.floor(dateObj.getTime() / 1000);
  const now = Math.floor(Date.now() / 1000);
  const busy = [...existingAppointments, ...blockouts];

  let best = 0;
  for (let m = openMin; m < closeMin; m += STEP) {
    const start = dayStart + m * 60;
    if (start <= now) continue;

    let free = closeMin - m;
    for (const w of busy) {
      const wStart = (w.startTime - dayStart) / 60;
      const wEnd = (w.endTime - dayStart) / 60;
      if (wEnd <= m) continue; // la ventana termina antes de este arranque
      // El bloque que arranca en m tiene que terminar como muy tarde cuando
      // empieza la ventana; si m cae DENTRO de ella, no hay nada libre (0).
      free = Math.min(free, Math.max(0, wStart - m));
    }
    if (free > best) best = free;
  }

  return best;
}

