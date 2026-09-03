import { NextResponse } from "next/server";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { TERMS_OF_SERVICE_KEY } from "@/lib/legal/termsOfService.types";
import { TERMS_OF_SERVICE_DEFAULTS } from "@/lib/legal/termsOfService.defaults";

export async function GET() {
  const row = db
    .select()
    .from(schema.legalSettings)
    .where(eq(schema.legalSettings.key, TERMS_OF_SERVICE_KEY))
    .get();

  if (!row) {
    return NextResponse.json(TERMS_OF_SERVICE_DEFAULTS);
  }
  return NextResponse.json({
    companyName: row.companyName,
    siteUrl: row.siteUrl,
    effectiveDate: row.effectiveDate,
    country: row.country,
    governingLaw: row.governingLaw,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    contactUrl: row.contactUrl,
    contactAddress: row.contactAddress,
    content: (row as { content?: string }).content ?? TERMS_OF_SERVICE_DEFAULTS.content,
  });
}
