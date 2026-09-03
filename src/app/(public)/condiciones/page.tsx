import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { renderTermsOfService } from "@/lib/legal/termsOfService";
import { TERMS_OF_SERVICE_KEY } from "@/lib/legal/termsOfService.types";
import { TERMS_OF_SERVICE_DEFAULTS } from "@/lib/legal/termsOfService.defaults";

export const dynamic = "force-dynamic";

export default async function CondicionesPage() {
  const row = db
    .select()
    .from(schema.legalSettings)
    .where(eq(schema.legalSettings.key, TERMS_OF_SERVICE_KEY))
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
        content: (row as { content?: string }).content ?? TERMS_OF_SERVICE_DEFAULTS.content,
      }
    : TERMS_OF_SERVICE_DEFAULTS;

  return (
    <div className="px-4 py-8">
      {!row && (
        <div className="mx-auto mb-6 max-w-3xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Estás viendo datos de ejemplo. Configura las condiciones reales en{" "}
          <a href="/dashboard/legal/terms" className="font-medium underline">
            /dashboard/legal/terms
          </a>
          .
        </div>
      )}
      {renderTermsOfService(values)}
    </div>
  );
}