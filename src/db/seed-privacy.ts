import { db, schema } from "./index";
import { eq } from "drizzle-orm";

const PRIVACY_KEY = "privacy_policy";

const existing = db
  .select()
  .from(schema.legalSettings)
  .where(eq(schema.legalSettings.key, PRIVACY_KEY))
  .get();

const values = {
  key: PRIVACY_KEY,
  companyName: "DreamNails Studio",
  siteUrl: "https://studiodreamnails.com",
  effectiveDate: "2026-09-02",
  country: "Venezuela",
  governingLaw: "las leyes de la República Bolivariana de Venezuela",
  contactEmail: "contacto@studiodreamnails.com",
  contactPhone: "+58 412-0000000",
  contactUrl: "https://studiodreamnails.com",
  contactAddress:
    "Dirección del estudio, Ciudad, Estado, Venezuela",
  content: null,
  updatedAt: Math.floor(Date.now() / 1000),
};

if (!existing) {
  db.insert(schema.legalSettings).values(values).run();
  console.log("Seeded privacy policy legal settings.");
} else {
  db.update(schema.legalSettings)
    .set(values)
    .where(eq(schema.legalSettings.key, PRIVACY_KEY))
    .run();
  console.log("Updated privacy policy legal settings.");
}

console.log("Privacy policy seed complete.");