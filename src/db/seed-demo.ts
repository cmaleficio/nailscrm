import { db, schema } from "./index";
import { eq } from "drizzle-orm";

const now = Math.floor(Date.now() / 1000);
const DAY = 86400;

function getServiceId(name: string): string {
  return (
    db
      .select()
      .from(schema.services)
      .where(eq(schema.services.name, name))
      .get()?.id ?? ""
  );
}

console.log("🌱 Seeding demo data...");

// ── Admin user ──
const adminId = crypto.randomUUID();
const existingAdmin = db
  .select()
  .from(schema.users)
  .where(eq(schema.users.email, "admin@nails.com"))
  .get();

if (!existingAdmin) {
  db.insert(schema.users)
    .values({
      id: adminId,
      name: "María (Admin)",
      email: "admin@nails.com",
      googleId: "admin-google-id",
      phone: "+584121234567",
      techNotes: "Dueña del salón",
      totalVisits: 0,
      totalRevenue: 0,
      createdAt: now - 30 * DAY,
    })
    .run();
  console.log("✅ Admin user created: admin@nails.com");
}

// ── Client user ──
const clientId = crypto.randomUUID();
const existingClient = db
  .select()
  .from(schema.users)
  .where(eq(schema.users.email, "clienta@email.com"))
  .get();

if (!existingClient) {
  db.insert(schema.users)
    .values({
      id: clientId,
      name: "Ana Martínez",
      email: "clienta@email.com",
      googleId: "client-google-id",
      phone: "+584987654321",
      techNotes: "Alergia al esmalte rojo. Prefiere diseños minimalistas.",
      totalVisits: 3,
      totalRevenue: 75,
      createdAt: now - 60 * DAY,
    })
    .run();
  console.log("✅ Client user created: clienta@email.com");
}

const actualClientId =
  existingClient?.id ??
  db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, "clienta@email.com"))
    .get()?.id ??
  clientId;

const actualAdminId =
  existingAdmin?.id ??
  db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, "admin@nails.com"))
    .get()?.id ??
  adminId;

// ── Appointments ──
const acrylicId = getServiceId("Acrílicas Full");
const gelId = getServiceId("Gel Semipermanente");
const classicId = getServiceId("Esmaltado Clásico");

const existingAppts = db.select().from(schema.appointments).all();

if (existingAppts.length === 0) {
  const appointments = [
    {
      id: crypto.randomUUID(),
      clientId: actualClientId,
      serviceId: gelId,
      startTime: now - 14 * DAY + 10 * 3600,
      endTime: now - 14 * DAY + 11 * 3600,
      status: "completed" as const,
      referencePhotoUrl: "https://picsum.photos/seed/nail1/400/400",
      finalPhotoUrl: "https://picsum.photos/seed/nail2/400/400",
      sharedToGallery: 1,
      createdAt: now - 15 * DAY,
    },
    {
      id: crypto.randomUUID(),
      clientId: actualClientId,
      serviceId: classicId,
      startTime: now - 7 * DAY + 15 * 3600,
      endTime: now - 7 * DAY + 15 * 3600 + 1800,
      status: "completed" as const,
      referencePhotoUrl: null,
      finalPhotoUrl: "https://picsum.photos/seed/nail3/400/400",
      sharedToGallery: 1,
      createdAt: now - 8 * DAY,
    },
    {
      id: crypto.randomUUID(),
      clientId: actualClientId,
      serviceId: acrylicId,
      startTime: now + 2 * DAY + 9 * 3600,
      endTime: now + 2 * DAY + 11 * 3600,
      status: "pending" as const,
      referencePhotoUrl: "https://picsum.photos/seed/nail4/400/400",
      finalPhotoUrl: null,
      sharedToGallery: 0,
      createdAt: now,
    },
  ];

  db.insert(schema.appointments).values(appointments).run();
  console.log(`✅ ${appointments.length} appointments created`);

  for (const a of appointments) {
    if (a.finalPhotoUrl) {
      db.insert(schema.appointmentPhotos)
        .values({
          id: crypto.randomUUID(),
          appointmentId: a.id,
          url: a.finalPhotoUrl,
          position: 0,
          createdAt: a.startTime + 3600,
          kind: "final",
        })
        .run();
    }
  }
}

// ── Gallery entries (extra for the muro) ──
const existingGallery = db
  .select()
  .from(schema.appointments)
  .where(eq(schema.appointments.sharedToGallery, 1))
  .all();

if (existingGallery.length <= 2) {
  const galleryEntries = [
    {
      id: crypto.randomUUID(),
      clientId: actualClientId,
      serviceId: acrylicId,
      startTime: now - 21 * DAY + 11 * 3600,
      endTime: now - 21 * DAY + 13 * 3600,
      status: "completed" as const,
      referencePhotoUrl: null,
      finalPhotoUrl: "https://picsum.photos/seed/nail5/400/500",
      sharedToGallery: 1,
      createdAt: now - 22 * DAY,
    },
    {
      id: crypto.randomUUID(),
      clientId: actualClientId,
      serviceId: gelId,
      startTime: now - 28 * DAY + 14 * 3600,
      endTime: now - 28 * DAY + 15 * 3600,
      status: "completed" as const,
      referencePhotoUrl: null,
      finalPhotoUrl: "https://picsum.photos/seed/nail6/400/300",
      sharedToGallery: 1,
      createdAt: now - 29 * DAY,
    },
    {
      id: crypto.randomUUID(),
      clientId: actualClientId,
      serviceId: acrylicId,
      startTime: now - 35 * DAY + 10 * 3600,
      endTime: now - 35 * DAY + 12 * 3600,
      status: "completed" as const,
      referencePhotoUrl: null,
      finalPhotoUrl: "https://picsum.photos/seed/nail7/400/600",
      sharedToGallery: 1,
      createdAt: now - 36 * DAY,
    },
  ];

  db.insert(schema.appointments).values(galleryEntries).run();
  console.log(`✅ ${galleryEntries.length} gallery entries created`);

  for (const g of galleryEntries) {
    if (g.finalPhotoUrl) {
      db.insert(schema.appointmentPhotos)
        .values({
          id: crypto.randomUUID(),
          appointmentId: g.id,
          url: g.finalPhotoUrl,
          position: 0,
          createdAt: g.startTime + 3600,
          kind: "final",
        })
        .run();
    }
  }
}

// ── Blockouts ──
const existingBlockouts = db.select().from(schema.blockouts).all();
if (existingBlockouts.length === 0) {
  db.insert(schema.blockouts)
    .values([
      {
        id: crypto.randomUUID(),
        startTime: now + 1 * DAY + 12 * 3600,
        endTime: now + 1 * DAY + 14 * 3600,
        reason: "Almuerzo extendido",
      },
      {
        id: crypto.randomUUID(),
        startTime: now + 3 * DAY,
        endTime: now + 3 * DAY + 24 * 3600,
        reason: "Día feriado",
      },
    ])
    .run();
  console.log("✅ Blockouts created");
}

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

console.log("✨ Demo data complete!");
