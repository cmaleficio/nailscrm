import bcrypt from "bcryptjs";
import { db, schema } from "./index";
import { eq } from "drizzle-orm";

const now = Math.floor(Date.now() / 1000);
const DAY = 86400;

const DEMO_EMAIL = "clienta@email.com";
const DEMO_PASSWORD = "Cliente123!";

async function main() {
console.log("🌱 Seeding demo client...");

let userId = db
  .select({ id: schema.users.id })
  .from(schema.users)
  .where(eq(schema.users.email, DEMO_EMAIL))
  .get()?.id;

if (!userId) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  userId = crypto.randomUUID();
  db.insert(schema.users)
    .values({
      id: userId,
      name: "Ana Martínez",
      email: DEMO_EMAIL,
      phone: "+584121234567",
      address: "Av. Principal, Res. Los Rosales, Torre B, Piso 3, Caracas",
      passwordHash,
      techNotes: "Alergia al esmalte rojo. Prefiere diseños minimalistas.",
      totalVisits: 3,
      totalRevenue: 85,
      createdAt: now - 60 * DAY,
    })
    .run();
  console.log(`✅ Cliente creado: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
} else {
  const existing = db
    .select({ passwordHash: schema.users.passwordHash })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();
  if (!existing?.passwordHash) {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    db.update(schema.users)
      .set({ passwordHash })
      .where(eq(schema.users.id, userId))
      .run();
    console.log(`✅ Contraseña asignada a ${DEMO_EMAIL}: ${DEMO_PASSWORD}`);
  } else {
    console.log(`ℹ️  Cliente ${DEMO_EMAIL} ya existía (mantiene su contraseña)`);
  }
}

function serviceId(name: string): string | undefined {
  return db
    .select({ id: schema.services.id })
    .from(schema.services)
    .where(eq(schema.services.name, name))
    .get()?.id;
}

const services = db.select().from(schema.services).all();

const existingAppts = db
  .select({ id: schema.appointments.id })
  .from(schema.appointments)
  .where(eq(schema.appointments.clientId, userId!))
  .all();

if (existingAppts.length > 0) {
  for (const a of existingAppts) {
    db.delete(schema.appointments)
      .where(eq(schema.appointments.id, a.id))
      .run();
  }
  console.log(`♻️  ${existingAppts.length} citas previas del demo eliminadas (se regeneran)`);
}

db.update(schema.users)
  .set({
    name: "Ana Martínez",
    phone: "+584121234567",
    address: "Av. Principal, Res. Los Rosales, Torre B, Piso 3, Caracas",
    techNotes: "Alergia al esmalte rojo. Prefiere diseños minimalistas.",
    totalVisits: 3,
    totalRevenue: 85,
  })
  .where(eq(schema.users.id, userId!))
  .run();

const existingHours = db.select().from(schema.workingHours).all();
if (existingHours.length === 0) {
  const hours = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isOpen: dayOfWeek !== 0 ? 1 : 0,
    startTime: "09:00",
    endTime: "18:00",
  }));
  db.insert(schema.workingHours).values(hours).run();
  console.log("✅ Working hours seeded");
}

const existingPayments = db
  .select({ id: schema.payments.id })
  .from(schema.payments)
  .where(eq(schema.payments.userId, userId!))
  .all();
for (const p of existingPayments) {
  db.delete(schema.payments).where(eq(schema.payments.id, p.id)).run();
}

const pickService = (fallbackName: string) => {
  const match = serviceId(fallbackName);
  return services.find((s) => s.id === match) ?? services[0];
};

const createdAppointmentIds: string[] = [];

const appointments = [
  {
    service: pickService("Gel Semipermanente"),
    daysFromNow: 3,
    hour: 10,
    status: "pending" as const,
    referenceUrls: [
      "https://picsum.photos/seed/nail-ref1/400/400",
      "https://picsum.photos/seed/nail-ref2/400/400",
    ],
    finalUrl: null,
    reviewRating: null,
    reviewText: null,
  },
  {
    service: pickService("Acrílicas Full"),
    daysFromNow: -14,
    hour: 9,
    status: "completed" as const,
    referenceUrls: [],
    finalUrl: "https://picsum.photos/seed/nail-done1/400/400",
    reviewRating: 5,
    reviewText: "¡Quedaron hermosas! Muy buena atención y el diseño duró semanas.",
  },
  {
    service: pickService("Esmaltado Clásico"),
    daysFromNow: -35,
    hour: 15,
    status: "completed" as const,
    referenceUrls: [],
    finalUrl: "https://picsum.photos/seed/nail-done2/400/400",
    reviewRating: 4,
    reviewText: "Buen servicio, muy puntuales.",
  },
];

for (const a of appointments) {
  const startTime = now + a.daysFromNow * DAY + a.hour * 3600;
  const endTime = startTime + a.service.durationMins * 60;
  const id = crypto.randomUUID();
  createdAppointmentIds.push(id);

  db.insert(schema.appointments)
    .values({
      id,
      clientId: userId!,
      serviceId: a.service.id,
      startTime,
      endTime,
      status: a.status,
      referencePhotoUrl: a.referenceUrls[0] ?? null,
      finalPhotoUrl: a.finalUrl,
      sharedToGallery: a.finalUrl ? 1 : 0,
      reviewRating: a.reviewRating,
      reviewText: a.reviewText,
      createdAt: startTime - 3600,
    })
    .run();

  a.referenceUrls.forEach((url, i) => {
    db.insert(schema.appointmentPhotos)
      .values({
        id: crypto.randomUUID(),
        appointmentId: id,
        url,
        position: i,
        createdAt: startTime - 3600,
      })
      .run();
  });

  if (a.finalUrl) {
    db.insert(schema.appointmentPhotos)
      .values({
        id: crypto.randomUUID(),
        appointmentId: id,
        url: a.finalUrl,
        position: 0,
        createdAt: startTime + a.service.durationMins * 60,
        kind: "final",
      })
      .run();
  }

  db.insert(schema.servicePurchases)
    .values({
      id: crypto.randomUUID(),
      userId: userId!,
      appointmentId: id,
      serviceId: a.service.id,
      serviceName: a.service.name,
      serviceDescription: a.service.description,
      servicePrice: a.service.price,
      serviceDurationMins: a.service.durationMins,
      createdAt: startTime - 3600,
    })
    .run();
}

console.log(`✅ ${appointments.length} citas creadas con snapshots y fotos`);

const demoPayments = [
  {
    amountUsd: 35,
    currency: "USD" as const,
    reference: "PAGO-001",
    paidAt: now - 14 * DAY + 11 * 3600,
  },
  {
    amountUsd: 10,
    currency: "USD" as const,
    reference: "PAGO-002",
    paidAt: now - 35 * DAY + 16 * 3600,
  },
];

const completedAppts = appointments.filter((a) => a.status === "completed");
for (let i = 0; i < demoPayments.length && i < completedAppts.length; i++) {
  const appointmentIdx = appointments.indexOf(completedAppts[i]);
  db.insert(schema.payments)
    .values({
      id: crypto.randomUUID(),
      userId: userId!,
      appointmentId: createdAppointmentIds[appointmentIdx] ?? null,
      amountUsd: demoPayments[i].amountUsd,
      currency: demoPayments[i].currency,
      reference: demoPayments[i].reference,
      paidAt: demoPayments[i].paidAt,
      createdBy: userId!,
      createdAt: now,
    })
    .run();
}
console.log(`✅ ${demoPayments.length} pagos demo registrados`);

const existingServicePhotos = db.select().from(schema.servicePhotos).all();
if (existingServicePhotos.length === 0) {
  const photoSeeds: { url: string; position: number }[] = [
    { url: "https://picsum.photos/seed/svc-acrilicas/500/400", position: 0 },
    { url: "https://picsum.photos/seed/svc-gel/500/400", position: 1 },
    { url: "https://picsum.photos/seed/svc-clasico/500/400", position: 2 },
  ];
  const svcList = db.select().from(schema.services).all();
  svcList.forEach((svc, i) => {
    const seed = photoSeeds[i % photoSeeds.length];
    db.insert(schema.servicePhotos)
      .values({
        id: crypto.randomUUID(),
        serviceId: svc.id,
        url: seed.url,
        position: seed.position,
        createdAt: now,
      })
      .run();
  });
  console.log("✅ Fotos de servicios sembradas");
}

console.log("✨ Demo client seed complete!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});