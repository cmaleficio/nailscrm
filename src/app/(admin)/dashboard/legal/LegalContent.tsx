"use client";

import { useEffect, useState } from "react";

type Values = {
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

const EMPTY: Values = {
  companyName: "",
  siteUrl: "",
  effectiveDate: "",
  country: "",
  governingLaw: "",
  contactEmail: "",
  contactPhone: "",
  contactUrl: "",
  contactAddress: "",
};

const labelCls = "block text-sm font-medium text-gray-700 mb-1";
const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";
const helpCls = "mt-1 text-xs text-gray-400";

export function LegalContent() {
  const [values, setValues] = useState<Values>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/legal/privacy")
      .then((r) => r.json())
      .then((data: Values) => {
        setValues({
          companyName: data.companyName ?? "",
          siteUrl: data.siteUrl ?? "",
          effectiveDate: data.effectiveDate ?? "",
          country: data.country ?? "",
          governingLaw: data.governingLaw ?? "",
          contactEmail: data.contactEmail ?? "",
          contactPhone: data.contactPhone ?? "",
          contactUrl: data.contactUrl ?? "",
          contactAddress: data.contactAddress ?? "",
        });
      })
      .catch(() => setError("No se pudo cargar la configuración"))
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof Values>(key: K, v: Values[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/admin/legal/privacy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: values.companyName,
          siteUrl: values.siteUrl,
          effectiveDate: values.effectiveDate,
          country: values.country,
          governingLaw: values.governingLaw,
          contactEmail: values.contactEmail,
          contactPhone: values.contactPhone || null,
          contactUrl: values.contactUrl || null,
          contactAddress: values.contactAddress,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar");
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-gray-500">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Legal</h1>
          <p className="text-sm text-gray-500">
            Datos que aparecen en la página pública de Política de Privacidad
          </p>
        </div>
        <a
          href="/politicas"
          className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Ver página pública
        </a>
      </div>

      <form
        onSubmit={save}
        className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div>
          <label className={labelCls} htmlFor="companyName">
            Nombre de la compañía
          </label>
          <input
            id="companyName"
            type="text"
            value={values.companyName}
            onChange={(e) => update("companyName", e.target.value)}
            className={inputCls}
            required
            maxLength={200}
          />
        </div>

        <div>
          <label className={labelCls} htmlFor="siteUrl">
            URL del sitio web
          </label>
          <input
            id="siteUrl"
            type="url"
            value={values.siteUrl}
            onChange={(e) => update("siteUrl", e.target.value)}
            className={inputCls}
            required
            placeholder="https://tusalon.com"
          />
          <p className={helpCls}>
            URL completa con https://
          </p>
        </div>

        <div>
          <label className={labelCls} htmlFor="effectiveDate">
            Fecha de vigencia
          </label>
          <input
            id="effectiveDate"
            type="date"
            value={values.effectiveDate}
            onChange={(e) => update("effectiveDate", e.target.value)}
            className={inputCls}
            required
          />
          <p className={helpCls}>
            Aparece como "Actualizado el" en la página pública
          </p>
        </div>

        <div>
          <label className={labelCls} htmlFor="country">
            País
          </label>
          <input
            id="country"
            type="text"
            value={values.country}
            onChange={(e) => update("country", e.target.value)}
            className={inputCls}
            required
            maxLength={100}
            placeholder="Venezuela"
          />
        </div>

        <div>
          <label className={labelCls} htmlFor="governingLaw">
            Ley aplicable
          </label>
          <input
            id="governingLaw"
            type="text"
            value={values.governingLaw}
            onChange={(e) => update("governingLaw", e.target.value)}
            className={inputCls}
            required
            maxLength={200}
            placeholder="la República Bolivariana de Venezuela"
          />
          <p className={helpCls}>
            Frase completa que se mostrará en "Ley que Rige"
          </p>
        </div>

        <div>
          <label className={labelCls} htmlFor="contactEmail">
            Correo de contacto
          </label>
          <input
            id="contactEmail"
            type="email"
            value={values.contactEmail}
            onChange={(e) => update("contactEmail", e.target.value)}
            className={inputCls}
            required
            placeholder="contacto@tusalon.com"
          />
        </div>

        <div>
          <label className={labelCls} htmlFor="contactPhone">
            Teléfono de contacto (opcional)
          </label>
          <input
            id="contactPhone"
            type="tel"
            value={values.contactPhone ?? ""}
            onChange={(e) => update("contactPhone", e.target.value)}
            className={inputCls}
            maxLength={50}
            placeholder="+58 412 1234567"
          />
        </div>

        <div>
          <label className={labelCls} htmlFor="contactUrl">
            Enlace de contacto (opcional)
          </label>
          <input
            id="contactUrl"
            type="url"
            value={values.contactUrl ?? ""}
            onChange={(e) => update("contactUrl", e.target.value)}
            className={inputCls}
            placeholder="https://tusalon.com/contacto"
          />
        </div>

        <div>
          <label className={labelCls} htmlFor="contactAddress">
            Dirección física
          </label>
          <textarea
            id="contactAddress"
            value={values.contactAddress}
            onChange={(e) => update("contactAddress", e.target.value)}
            className={inputCls}
            required
            maxLength={500}
            rows={3}
            placeholder="Calle 42, Maracaibo, Zulia"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        {saved && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600">
            Datos guardados
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {saving ? "Guardando..." : "Guardar datos legales"}
        </button>
      </form>
    </div>
  );
}
