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
};

export function generateSlots(input: SlotInput): SlotTime[] {
  const { date, durationMins, existingAppointments, blockouts } = input;

  const dateObj = new Date(date + "T00:00:00-04:00");
  const dayStart = Math.floor(dateObj.getTime() / 1000);
  const dayEnd = dayStart + 24 * 3600;

  const OPEN = 9;
  const CLOSE = 18;

  const slots: SlotTime[] = [];

  for (let h = OPEN; h + durationMins / 60 <= CLOSE; h++) {
    const slotStart = dayStart + h * 3600;
    const slotEnd = slotStart + durationMins * 60;

    const overlapsAppointment = existingAppointments.some(
      (a) => slotStart < a.endTime && slotEnd > a.startTime
    );

    const overlapsBlockout = blockouts.some(
      (b) => slotStart < b.endTime && slotEnd > b.startTime
    );

    const now = Math.floor(Date.now() / 1000);
    const isPast = slotStart <= now;

    slots.push({
      hour: h,
      minute: 0,
      label: `${String(h).padStart(2, "0")}:00`,
      available: !overlapsAppointment && !overlapsBlockout && !isPast,
    });
  }

  return slots;
}
