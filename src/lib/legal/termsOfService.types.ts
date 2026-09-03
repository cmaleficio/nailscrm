export type TermsOfServiceValues = {
  companyName: string;
  siteUrl: string;
  effectiveDate: string;
  country: string;
  governingLaw: string;
  contactEmail: string;
  contactPhone: string | null;
  contactUrl: string | null;
  contactAddress: string;
  content: string;
};

export const TERMS_OF_SERVICE_KEY = "terms_of_service";
