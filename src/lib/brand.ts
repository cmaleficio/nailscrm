import { db, schema } from "@/db/index";

const DEFAULTS: Record<string, string> = {
  name: "DreamNails Studio",
  logo_url: "",
};

export function getBrandSettings(): Record<string, string> {
  const rows = db.select().from(schema.brandSettings).all();
  const map: Record<string, string> = { ...DEFAULTS };
  for (const r of rows) {
    if (r.value !== null) map[r.key] = r.value;
  }
  return map;
}

export function getSalonName(): string {
  return getBrandSettings().name || process.env.NEXT_PUBLIC_SALON_NAME || "Nails Salon";
}

export function getSalonLogo(): string {
  return getBrandSettings().logo_url || "";
}
