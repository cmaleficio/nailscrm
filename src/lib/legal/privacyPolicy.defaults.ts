import type { PrivacyPolicyValues } from "./privacyPolicy.types";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const PRIVACY_POLICY_DEFAULTS: PrivacyPolicyValues = {
  companyName: "Tu Salón",
  siteUrl: "https://example.com",
  effectiveDate: todayIso(),
  country: "tu país",
  governingLaw: "las leyes de tu país",
  contactEmail: "contacto@example.com",
  contactPhone: null,
  contactUrl: null,
  contactAddress: "tu dirección completa",
};