import { db, schema } from "./index";
import { eq } from "drizzle-orm";

const existing = db
  .select()
  .from(schema.brandSettings)
  .where(eq(schema.brandSettings.key, "name"))
  .get();

if (!existing) {
  db.insert(schema.brandSettings)
    .values({ key: "name", value: "DreamNails Studio" })
    .run();
  console.log("✅ Seeded brand name: DreamNails Studio");
} else {
  console.log(`ℹ️  Brand name already exists: ${existing.value}`);
}

console.log("✨ Brand seed complete!");
