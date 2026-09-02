import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authz";
import { PRIVACY_POLICY_KEY } from "@/lib/legal/privacyPolicy.types";
import { PRIVACY_POLICY_DEFAULTS } from "@/lib/legal/privacyPolicy.defaults";

const URL_RE = /^https?:\/\/\S+$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type PutBody = {
  companyName?: unknown;
  siteUrl?: unknown;
  effectiveDate?: unknown;
  country?: unknown;
  governingLaw?: unknown;
  contactEmail?: unknown;
  contactPhone?: unknown;
  contactUrl?: unknown;
  contactAddress?: unknown;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function optStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export async function GET() {
  const session = await auth();
  if (!(await hasPermission(session, "settings"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const row = db
    .select()
    .from(schema.legalSettings)
    .where(eq(schema.legalSettings.key, PRIVACY_POLICY_KEY))
    .get();

  if (!row) {
    return NextResponse.json({ ...PRIVACY_POLICY_DEFAULTS, updatedAt: 0, updatedBy: null });
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
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!(await hasPermission(session, "settings"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as PutBody;

  const companyName = str(body.companyName);
  const siteUrl = str(body.siteUrl);
  const effectiveDate = str(body.effectiveDate);
  const country = str(body.country);
  const governingLaw = str(body.governingLaw);
  const contactEmail = str(body.contactEmail);
  const contactPhone = optStr(body.contactPhone);
  const contactUrl = optStr(body.contactUrl);
  const contactAddress = str(body.contactAddress);

  if (!companyName) return NextResponse.json({ error: "El nombre de la compañía es obligatorio" }, { status: 400 });
  if (companyName.length > 200) return NextResponse.json({ error: "El nombre de la compañía es demasiado largo" }, { status: 400 });
  if (!siteUrl || !URL_RE.test(siteUrl)) return NextResponse.json({ error: "La URL del sitio no es válida" }, { status: 400 });
  if (!ISO_DATE_RE.test(effectiveDate) || Number.isNaN(Date.parse(effectiveDate))) {
    return NextResponse.json({ error: "La fecha de vigencia debe tener formato YYYY-MM-DD" }, { status: 400 });
  }
  if (!country) return NextResponse.json({ error: "El país es obligatorio" }, { status: 400 });
  if (country.length > 100) return NextResponse.json({ error: "El país es demasiado largo" }, { status: 400 });
  if (!governingLaw) return NextResponse.json({ error: "La ley aplicable es obligatoria" }, { status: 400 });
  if (governingLaw.length > 200) return NextResponse.json({ error: "La ley aplicable es demasiado larga" }, { status: 400 });
  if (!contactEmail || !EMAIL_RE.test(contactEmail)) return NextResponse.json({ error: "El correo de contacto no es válido" }, { status: 400 });
  if (contactPhone && contactPhone.length > 50) return NextResponse.json({ error: "El teléfono es demasiado largo" }, { status: 400 });
  if (contactUrl && !URL_RE.test(contactUrl)) return NextResponse.json({ error: "La URL de contacto no es válida" }, { status: 400 });
  if (!contactAddress) return NextResponse.json({ error: "La dirección es obligatoria" }, { status: 400 });
  if (contactAddress.length > 500) return NextResponse.json({ error: "La dirección es demasiado larga" }, { status: 400 });

  const now = Math.floor(Date.now() / 1000);
  const updatedBy = session!.user.id;

  const existing = db
    .select({ key: schema.legalSettings.key })
    .from(schema.legalSettings)
    .where(eq(schema.legalSettings.key, PRIVACY_POLICY_KEY))
    .get();

  if (existing) {
    db.update(schema.legalSettings)
      .set({
        companyName,
        siteUrl,
        effectiveDate,
        country,
        governingLaw,
        contactEmail,
        contactPhone,
        contactUrl,
        contactAddress,
        updatedAt: now,
        updatedBy,
      })
      .where(eq(schema.legalSettings.key, PRIVACY_POLICY_KEY))
      .run();
  } else {
    db.insert(schema.legalSettings)
      .values({
        key: PRIVACY_POLICY_KEY,
        companyName,
        siteUrl,
        effectiveDate,
        country,
        governingLaw,
        contactEmail,
        contactPhone,
        contactUrl,
        contactAddress,
        updatedAt: now,
        updatedBy,
      })
      .run();
  }

  return NextResponse.json({
    companyName,
    siteUrl,
    effectiveDate,
    country,
    governingLaw,
    contactEmail,
    contactPhone,
    contactUrl,
    contactAddress,
    updatedAt: now,
    updatedBy,
  });
}
