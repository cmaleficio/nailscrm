import { NextResponse } from "next/server";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { PRIVACY_POLICY_KEY } from "@/lib/legal/privacyPolicy.types";
import { PRIVACY_POLICY_DEFAULTS } from "@/lib/legal/privacyPolicy.defaults";

export async function GET() {
  const row = db
    .select()
    .from(schema.legalSettings)
    .where(eq(schema.legalSettings.key, PRIVACY_POLICY_KEY))
    .get();

  if (!row) {
    return NextResponse.json(PRIVACY_POLICY_DEFAULTS);
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
  });
}