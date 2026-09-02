import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { renderPrivacyPolicy } from "@/lib/legal/privacyPolicy";
import { PRIVACY_POLICY_KEY } from "@/lib/legal/privacyPolicy.types";
import { PRIVACY_POLICY_DEFAULTS } from "@/lib/legal/privacyPolicy.defaults";

export const dynamic = "force-dynamic";

export default async function PoliticasPage() {
  const row = db
    .select()
    .from(schema.legalSettings)
    .where(eq(schema.legalSettings.key, PRIVACY_POLICY_KEY))
    .get();

  const values = row
    ? {
        companyName: row.companyName,
        siteUrl: row.siteUrl,
        effectiveDate: row.effectiveDate,
        country: row.country,
        governingLaw: row.governingLaw,
        contactEmail: row.contactEmail,
        contactPhone: row.contactPhone,
        contactUrl: row.contactUrl,
        contactAddress: row.contactAddress,
      }
    : PRIVACY_POLICY_DEFAULTS;

  return (
    <div className="px-4 py-8">
      {!row && (
        <div className="mx-auto mb-6 max-w-3xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Estás viendo datos de ejemplo. Configura los datos reales en{" "}
          <a href="/dashboard/legal" className="font-medium underline">
            /dashboard/legal
          </a>
          .
        </div>
      )}
      {renderPrivacyPolicy(values)}
    </div>
  );
}
