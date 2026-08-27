import { db, schema } from "./index";
import { eq } from "drizzle-orm";
import { readdirSync, unlinkSync, existsSync } from "fs";
import { join } from "path";

console.log("🧹 Resetting database to fresh state...\n");

// 1. Delete transactional data (child tables first due to FK)
const tablesToDelete = [
  schema.paymentReceipts,
  schema.appointmentPhotos,
  schema.servicePurchases,
  schema.supplierPayments,
  schema.billItems,
  schema.inventoryMovements,
  schema.serviceProducts,
  schema.cancelledAppointments,
  schema.payments,
  schema.appointments,
  schema.bills,
  schema.galleryPhotos,
  schema.servicePhotos,
  schema.waitlist,
  schema.blockouts,
  schema.inventoryItems,
  schema.suppliers,
];

for (const table of tablesToDelete) {
  db.delete(table).run();
}
console.log(`✅ Deleted data from ${tablesToDelete.length} tables`);

// 2. Delete ALL services (user will create their own)
db.delete(schema.services).run();
console.log("✅ Deleted all services");

// 3. Delete verification tokens
db.delete(schema.verificationTokens).run();
console.log("✅ Deleted verification tokens");

// 4. Reset admin user stats (keep the user, reset counters)
const admins = db
  .select()
  .from(schema.users)
  .where(eq(schema.users.role, "admin"))
  .all();

for (const admin of admins) {
  db.update(schema.users)
    .set({
      totalVisits: 0,
      totalRevenue: 0,
      techNotes: null,
    })
    .where(eq(schema.users.id, admin.id))
    .run();
  console.log(`✅ Reset admin: ${admin.email} (stats → 0)`);
}

// 5. Delete non-admin users (clients)
const clients = db
  .select()
  .from(schema.users)
  .where(eq(schema.users.role, "client"))
  .all();

for (const client of clients) {
  // Auth.js cascade will handle account/session via FK onDelete
  db.delete(schema.users).where(eq(schema.users.id, client.id)).run();
}
if (clients.length > 0) {
  console.log(`✅ Deleted ${clients.length} client(s)`);
} else {
  console.log("ℹ️  No clients to delete");
}

// 6. Clean uploaded files (keep .gitkeep)
const uploadsDir = join(process.cwd(), "public", "uploads");
if (existsSync(uploadsDir)) {
  const files = readdirSync(uploadsDir);
  let deleted = 0;
  for (const file of files) {
    if (file === ".gitkeep") continue;
    const filePath = join(uploadsDir, file);
    try {
      unlinkSync(filePath);
      deleted++;
    } catch {
      // ignore
    }
  }
  console.log(`✅ Deleted ${deleted} uploaded file(s)`);
}

// 7. Re-seed 3 base services
const services = [
  {
    id: crypto.randomUUID(),
    name: "Acrílicas Full",
    description: "Uñas acrílicas esculpidas a mano con diseño clásico",
    price: 35,
    durationMins: 120,
    isActive: 1,
  },
  {
    id: crypto.randomUUID(),
    name: "Gel Semipermanente",
    description: "Esmaltado en gel semipermanente de larga duración",
    price: 25,
    durationMins: 60,
    isActive: 1,
  },
  {
    id: crypto.randomUUID(),
    name: "Esmaltado Clásico",
    description: "Esmaltado tradicional con secado al aire",
    price: 15,
    durationMins: 30,
    isActive: 1,
  },
];
db.insert(schema.services).values(services).run();
console.log(`✅ Seeded ${services.length} base services`);

// 8. Ensure expense categories exist (in case they were deleted)
const existingCategories = db.select().from(schema.expenseCategories).all();
if (existingCategories.length === 0) {
  const categoryNames = [
    "Insumos y materiales",
    "Alquiler",
    "Servicios básicos",
    "Nómina",
    "Marketing y publicidad",
    "Otros",
  ];
  db.insert(schema.expenseCategories)
    .values(
      categoryNames.map((name) => ({
        id: crypto.randomUUID(),
        name,
        isActive: 1,
        createdAt: Math.floor(Date.now() / 1000),
      }))
    )
    .run();
  console.log(`✅ Seeded ${categoryNames.length} expense categories`);
} else {
  console.log(`ℹ️  Expense categories already exist (${existingCategories.length})`);
}

// 9. Ensure working hours exist
const existingHours = db.select().from(schema.workingHours).all();
if (existingHours.length === 0) {
  const hours = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isOpen: dayOfWeek !== 0 ? 1 : 0,
    startTime: "09:00",
    endTime: "18:00",
  }));
  db.insert(schema.workingHours).values(hours).run();
  console.log("✅ Seeded working hours (Lun-Sáb 09:00-18:00)");
} else {
  console.log(`ℹ️  Working hours already exist (${existingHours.length} days)`);
}

// 10. Ensure brand settings exist
const existingBrand = db
  .select()
  .from(schema.brandSettings)
  .where(eq(schema.brandSettings.key, "name"))
  .get();
if (!existingBrand) {
  db.insert(schema.brandSettings)
    .values({ key: "name", value: "DreamNails Studio" })
    .run();
  console.log("✅ Seeded brand name: DreamNails Studio");
} else {
  console.log(`ℹ️  Brand name already exists: ${existingBrand.value}`);
}

// Summary
const counts = {
  users: db.select().from(schema.users).all().length,
  services: db.select().from(schema.services).all().length,
  appointments: db.select().from(schema.appointments).all().length,
  payments: db.select().from(schema.payments).all().length,
  exchangeRates: db.select().from(schema.exchangeRates).all().length,
  bankAccounts: db.select().from(schema.bankAccounts).all().length,
};

console.log("\n📊 Summary:");
console.log(`   Users: ${counts.users} (admin only)`);
console.log(`   Services: ${counts.services}`);
console.log(`   Appointments: ${counts.appointments}`);
console.log(`   Payments: ${counts.payments}`);
console.log(`   Exchange rates: ${counts.exchangeRates}`);
console.log(`   Bank accounts: ${counts.bankAccounts}`);
console.log("\n✨ Reset complete! Database is fresh.");
