export type PrivacyPolicyValues = {
  companyName: string;
  siteUrl: string;
  effectiveDate: string;
  country: string;
  governingLaw: string;
  contactEmail: string;
  contactPhone: string | null;
  contactUrl: string | null;
  contactAddress: string;
};

export const PRIVACY_POLICY_KEY = "privacy_policy";