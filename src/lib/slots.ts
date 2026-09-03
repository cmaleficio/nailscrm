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

export function generateSlots(input: SlotInput): SlotTime[] {
  const { date, durationMins, existingAppointments, blockouts, openMin, closeMin } = input;

  const dateObj = new Date(date + "T00:00:00-04:00");
  const dayStart = Math.floor(dateObj.getTime() / 1000);

  const slots: SlotTime[] = [];

  const step = 15;
  for (let m = openMin; m + durationMins <= closeMin; m += step) {
    const slotStart = dayStart + m * 60;
    const slotEnd = slotStart + durationMins * 60;

    const overlapsAppointment = existingAppointments.some(
      (a) => slotStart < a.endTime && slotEnd > a.startTime
    );

    const overlapsBlockout = blockouts.some(
      (b) => slotStart < b.endTime && slotEnd > b.startTime
    );

    const now = Math.floor(Date.now() / 1000);
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
