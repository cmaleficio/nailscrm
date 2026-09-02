# Privacy Policy Page — Design Spec

**Date:** 2026-09-02
**Status:** Approved (pending user review of this spec)
**Path classification:** Architectural

## 1. Purpose

The Nail salon web app needs a public **Privacy Policy** page that Google (and any other compliance auditor) can point to. The page must be linked from the public site and must be editable from the admin panel so the salon owner can update identity data (name, address, contact info, jurisdiction, effective date) without touching code.

A reusable **opencode skill** must capture the recipe so the same flow can be reused when adding other legal documents (TOS, cookie policy) or migrated to other Next.js projects.

## 2. Goals and non-goals

### Goals

- Public route `/politicas` renders a complete privacy policy in Spanish, sourced from the 20 PNGs in `img-pp/`.
- Admin route `/dashboard/legal` lets an admin with the `settings` permission edit the 8 variable fields of the policy.
- Variable fields are stored in a Drizzle/SQLite singleton row (one record, fixed PK `key='privacy_policy'`).
- The body of the policy is a **static React component** that interpolates the 8 fields at render time. The admin does **not** edit body text.
- Public page is reachable without authentication; admin endpoints require session + permission.
- A reusable skill `privacy-policy-page` documents the end-to-end recipe.

### Non-goals

- No public versioned history of policy changes (out of scope per user decision).
- No multi-document legal hub (only privacy policy for now; the schema is shaped to accept more `key` values later).
- No rich-text editing of body text (admin edits the 8 variable fields only).
- No multi-tenant: this skill is specific to a single salon.

## 3. Source of truth — the 8 variable fields

These are the placeholders identified in the OCR of the 20 PNGs in `img-pp/`:

| OCR placeholder | Field name | Required | Notes |
|---|---|---|---|
| `[Actualizado el]` | `effectiveDate` | yes | ISO `YYYY-MM-DD` |
| `[Compañía / Sitio web / "nosotros"]` | `companyName` | yes | e.g. "Ana Nail Studio" |
| `[Sitio web al que se puede acceder a través de esta URL]` | `siteUrl` | yes | full URL, validated |
| `[País: donde se encuentra]` | `country` | yes | free text, e.g. "Venezuela" |
| `[Las leyes de … rigen esta política]` | `governingLaw` | yes | free text, e.g. "la República Bolivariana de Venezuela" |
| `[A través de correo electrónico: …]` | `contactEmail` | yes | email validated |
| `[A través del número de teléfono: …]` | `contactPhone` | no | free text, optional |
| `[A través de este enlace: …]` | `contactUrl` | no | URL validated, optional |
| `[A través de esta dirección: …]` | `contactAddress` | yes | free text, full postal address |

**Total: 8 user-editable fields. 5 required, 3 optional. 1 metadata field (singleton key).**

## 4. Data model

A new Drizzle table `legalSettings` in `src/db/schema.ts`:

```ts
export const legalSettings = sqliteTable("legal_settings", {
  key: text("key").primaryKey(),                       // singleton: "privacy_policy"
  companyName: text("company_name").notNull(),
  siteUrl: text("site_url").notNull(),
  effectiveDate: text("effective_date").notNull(),     // ISO "YYYY-MM-DD"
  country: text("country").notNull(),
  governingLaw: text("governing_law").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  contactUrl: text("contact_url"),
  contactAddress: text("contact_address").notNull(),
  updatedAt: integer("updated_at").notNull(),
  updatedBy: text("updated_by").references(() => users.id),
});
```

Rationale for singleton: the user explicitly chose "no public versioning" and a single document. A fixed PK is simpler than a per-document table and matches the `brand_settings` key/value pattern already in the schema (cf. `brandSettings` in `src/db/schema.ts:371`).

If multi-document support is added later, the same table accepts additional `key` values (`'tos'`, `'cookies'`, etc.) without schema changes.

## 5. API

Three endpoints:

### 5.1 `GET /api/legal/privacy` (public)

- Auth: none.
- Response: `{ key, companyName, siteUrl, effectiveDate, country, governingLaw, contactEmail, contactPhone, contactUrl, contactAddress, updatedAt }` or sensible defaults if the row does not exist yet.
- Status: 200 always.

### 5.2 `GET /api/admin/legal/privacy` (admin)

- Auth: `hasPermission(session, "settings")` (same gate as working-hours settings, matches user's "reuse existing permission" decision).
- Response: same shape as above, plus `updatedBy` (display name).
- Status: 401 if unauthorized.

### 5.3 `PUT /api/admin/legal/privacy` (admin)

- Auth: `hasPermission(session, "settings")`.
- Body: full record (all 8 fields, same shape as GET).
- Validations (400 with `{error}` on failure):
  - `companyName` non-empty string, max 200.
  - `siteUrl` matches URL regex (`^https?://…`).
  - `effectiveDate` matches `^\d{4}-\d{2}-\d{2}$` and is a parseable date.
  - `country` non-empty, max 100.
  - `governingLaw` non-empty, max 200.
  - `contactEmail` matches email regex.
  - `contactPhone` (optional) string, max 50.
  - `contactUrl` (optional) URL regex if present.
  - `contactAddress` non-empty, max 500.
- Side effects: upsert the singleton row, set `updatedAt = now`, set `updatedBy = session.user.id`.
- Response: 200 with updated record.

## 6. Public page `/politicas`

- Server component `src/app/(public)/politicas/page.tsx`.
- Layout: lives under the public layout (with `Header`), centered narrow column with `prose` styling.
- Loads the row from `legalSettings` via the Drizzle db.
- If the row does not exist, displays a yellow info banner "Configura los datos legales en /dashboard/legal" above default placeholders (`Tu Salón`, today's date, etc.). Does **not** crash.
- Footer: "Última actualización: {effectiveDate} · Volver al inicio".
- Performance: server-rendered, no client-side JS, no auth checks. Same model as the existing `(public)` pages.

## 7. Body rendering — the static policy

File: `src/lib/legal/privacyPolicy.tsx`.

Exports:
```ts
export type PrivacyPolicyValues = {
  companyName: string;
  siteUrl: string;
  effectiveDate: string;       // ISO YYYY-MM-DD, formatted as "DD [mes] YYYY" in the body
  country: string;
  governingLaw: string;
  contactEmail: string;
  contactPhone: string | null;
  contactUrl: string | null;
  contactAddress: string;
};

export function renderPrivacyPolicy(values: PrivacyPolicyValues): React.ReactNode;
```

The component returns a `<article>` with the full text of the privacy policy, where the 8 placeholders are replaced by `values.*`. Body text comes from the cleaned OCR of `img-pp/*.png` (already extracted to `img-pp-ocr/_all.txt`).

The body is **not** user-editable. The admin only edits the 8 fields. The text follows the OCR structure 1:1, with:
- Spanish language kept verbatim.
- OCR typos silently corrected (e.g. "Serefiere" → "Se refiere", "utlizada" → "utilizada"). A diff vs OCR is committed in `docs/superpowers/specs/2026-09-02-privacy-policy-design.md#ocr-corrections` for traceability.
- Missing data in OCR (company name, country, etc.) is left as `{values.companyName}` interpolation points, **not** filled in.

## 8. Admin page `/dashboard/legal`

- Server component wrapper at `src/app/(admin)/dashboard/legal/page.tsx` (same pattern as `settings/page.tsx`).
- Client component `src/app/(admin)/dashboard/legal/LegalContent.tsx`:
  - On mount: `fetch('/api/admin/legal/privacy')`, populates form.
  - Form: 8 labeled inputs (text, email, url, date, textarea for address).
  - Submit button → `PUT /api/admin/legal/privacy`.
  - Success banner "Datos guardados", error banner with message.
  - "Ver página pública" link → `/politicas` (same-tab navigation; opens the public route from inside the admin app).
- Visual style reuses the existing `SettingsContent` card pattern: `mx-auto max-w-2xl`, white card with `rounded-xl border border-gray-200`, `inputCls` for inputs.
- No new permission key. Reuses the existing `settings` permission. (Adding `legal` later is non-breaking.)

## 9. Navigation update

Add "Legal" link in the admin sidebar/dashboard nav. The exact entry point is the existing `DashboardContent` sidebar; we add a new item pointing to `/dashboard/legal` between "Configuración" and any other admin entry.

## 10. Files to create / modify

**Create:**
- `src/lib/legal/privacyPolicy.tsx` — body renderer
- `src/lib/legal/privacyPolicy.types.ts` — `PrivacyPolicyValues` type
- `src/lib/legal/privacyPolicy.defaults.ts` — fallback values when row missing
- `src/app/api/legal/privacy/route.ts` — public GET
- `src/app/api/admin/legal/privacy/route.ts` — admin GET + PUT
- `src/app/(public)/politicas/page.tsx` — public page
- `src/app/(admin)/dashboard/legal/page.tsx` — admin page wrapper
- `src/app/(admin)/dashboard/legal/LegalContent.tsx` — admin form
- `drizzle/0000_<id>.sql` (auto-generated) — migration adding `legal_settings`
- `.agents/skills/privacy-policy-page/SKILL.md` — the reusable skill
- `docs/superpowers/specs/2026-09-02-privacy-policy-design.md` — this file

**Modify:**
- `src/db/schema.ts` — add `legalSettings` table
- `src/app/(admin)/dashboard/DashboardContent.tsx` — add Legal nav link
- `AGENTS.md` — add public route `/politicas`, admin route `/dashboard/legal`, table `legal_settings`
- `CHANGELOG.md` — entry under next version
- `README.md` — if it lists routes

## 11. Testing

No test framework is set up in this project (per AGENTS.md). Verification will be done manually:
1. `npm run db:setup` to apply the new migration.
2. `npm run dev`, visit `/politicas` → should render with default values.
3. Login as admin, visit `/dashboard/legal`, change the company name, save.
4. Reload `/politicas` → the new name should appear.
5. `npm run lint` and `npx tsc --noEmit` to confirm no type or lint errors.
6. `npm run build && npm start` smoke test of the production build.

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| OCR text is wrong/misleading in the body | Body is taken from `_all.txt`; we corrected obvious OCR typos. Spec lists corrections for traceability. Admin cannot edit body, so a future fix requires a code change. |
| Google compliance still rejects the page | The body is comprehensive (RGPD, cookies, third parties, children's privacy, contact). If a specific issue arises, the body is in one file (`privacyPolicy.tsx`) for fast edits. |
| `settings` permission is too broad for legal data | Permission reuse is per user decision. If isolation is needed later, a `legal` permission key is non-breaking. |
| User types a malformed URL/email and 500s | Strict input validation in the PUT handler with clear Spanish error messages. |
| Date in `effectiveDate` is shown in ambiguous format | Stored as ISO, rendered as `DD [month] YYYY` in Spanish locale in the public page. |

## 13. Reusable skill `privacy-policy-page`

Location: `.agents/skills/privacy-policy-page/SKILL.md`.

A single integral skill that documents:
1. When to use it (compliance auditor requires a privacy policy page; or upgrading an existing one).
2. The input it expects (image/PDF/text of the policy).
3. How to extract the text (Tesseract for images, pdftotext for PDFs, direct paste for text).
4. The 8 standard variable fields and how to map them to the OCR.
5. The Drizzle schema pattern (singleton `legal_settings`).
6. The API contract (public GET + admin GET/PUT).
7. The admin UI pattern (card form with 8 inputs).
8. The public page pattern (server component + static body component).
9. A short list of legal sections a privacy policy should contain, with which ones are covered by the OCR'd template and which are missing (e.g. data breach notification, DPO contact).

The skill is **specific to a single Next.js + Drizzle + SQLite salon webapp** but is structured so its steps are portable to any Next.js project with admin CRUD.

## 14. Open questions

None — all design decisions were confirmed in the brainstorming phase.

## 15. OCR corrections log

These typos were silently corrected in `privacyPolicy.tsx`. Original is in `img-pp-ocr/_all.txt`.

| Original (OCR) | Corrected |
|---|---|
| `Serefiere` | `Se refiere` |
| `utlizada` | `utilizada` |
| `datos delÍnternet` | `datos del Internet` |
| `fecopilamos` | `recopilamos` |
| `((P)` (IP) | `IP` |
| `mo` (mid-sentence) | `_` (replaced with `{companyName}` placeholder) |
| `Tecibimos` | `recibimos` |
| `sístema` | `sistema` |
| `actualizaf` | `actualizar` |
| `transferirsé` | `transferirse` |
| `d8` | `de` |
| `deGookies` | `de cookies` |
| `requisitos de esta nueva regulación` (trailing period issues) | unchanged |

The body is a faithful Spanish translation of the OCR'd source, with only spelling/typo fixes and the 8 placeholder interpolations. The legal substance is preserved verbatim.

## 16. Out of scope (deferred)

- Cookie consent banner (would require a runtime cookie audit, not just text).
- Multi-language (English version of the policy).
- Public history of policy revisions.
- DPO contact email (separate from `contactEmail`).
- Terms of service / refund policy documents (same skill + new singleton row each).
