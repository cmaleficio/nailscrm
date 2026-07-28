import { db, schema } from "./index";

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

console.log("🌱 Seeding services...");
db.insert(schema.services).values(services).run();
console.log(`✅ Inserted ${services.length} services`);
console.log("✨ Seed complete!");
