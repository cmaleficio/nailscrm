"use client";

import { useEffect, useState } from "react";
import {
  buildGoogleAnalyticsSnippet,
  isValidMeasurementId,
  MAX_SNIPPET_LENGTH,
} from "@/lib/tracking-tags";

const DEFAULT_MEASUREMENT_ID = "G-YBQKMQVS68";

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

/**
 * Editor del snippet de etiquetas de analítica. Solo el superadmin llega aquí
 * (la página /dashboard/admin-users ya está restringida), y el API lo vuelve a
 * comprobar: guardar es inyectar JS arbitrario en el navegador de cada visitante.
 */
export function TrackingTagsSection() {
  const [snippet, setSnippet] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [measurementId, setMeasurementId] = useState(DEFAULT_MEASUREMENT_ID);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/admin/tracking-tags")
      .then((r) => r.json())
      .then((data: { snippet?: string; isEnabled?: boolean }) => {
        setSnippet(data.snippet ?? "");
        setIsEnabled(data.isEnabled ?? true);
      })
      .catch(() => setError("No se pudo cargar la configuración de analítica"))
      .finally(() => setLoading(false));
  }, []);

  function fillGoogleExample() {
    try {
      setSnippet(buildGoogleAnalyticsSnippet(measurementId));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Measurement ID inválido");
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/tracking-tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snippet, isEnabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      setSnippet(data.snippet ?? snippet);
      setIsEnabled(data.isEnabled ?? isEnabled);
      setSuccess("Guardado. Las etiquetas se aplican en las páginas públicas.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  const charCount = snippet.length;

  return (
    <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900">Etiquetas de analítica</h2>
      <p className="mt-1 text-sm text-gray-500">
        Pega aquí el código de Google Analytics, Google Tag Manager o cualquier otro tag. Se
        inyecta en las páginas públicas (inicio, reservas, reseñas, portal del cliente), nunca
        dentro del dashboard.
      </p>

      <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Este código se ejecuta en el navegador de todas las visitas del sitio. Solo el
        administrador principal puede guardarlo, y cada cambio queda registrado en el log de
        actividad.
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-gray-500">Cargando…</p>
      ) : (
        <>
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="ga-id">
              Pegar ejemplo de Google Analytics
            </label>
            <div className="flex gap-2">
              <input
                id="ga-id"
                className={inputCls}
                value={measurementId}
                onChange={(e) => setMeasurementId(e.target.value)}
                placeholder="G-XXXXXXXXXX"
              />
              <button
                type="button"
                onClick={fillGoogleExample}
                disabled={!isValidMeasurementId(measurementId)}
                className="shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Generar
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Escribe tu Measurement ID y el botón arma el snippet oficial de gtag.js.
            </p>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="snippet">
              Código de las etiquetas
            </label>
            <textarea
              id="snippet"
              rows={10}
              value={snippet}
              maxLength={MAX_SNIPPET_LENGTH}
              onChange={(e) => setSnippet(e.target.value)}
              placeholder="<!-- Google tag (gtag.js) -->&#10;<script async src=&quot;https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX&quot;></script>"
              className={`${inputCls} font-mono text-xs leading-relaxed`}
              spellCheck={false}
            />
            <p className={`mt-1 text-xs ${charCount > MAX_SNIPPET_LENGTH ? "text-red-600" : "text-gray-400"}`}>
              {charCount} / {MAX_SNIPPET_LENGTH} caracteres
            </p>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-pink-main focus:ring-pink-main"
            />
            Etiquetas activas
          </label>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          {success && (
            <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600">{success}</p>
          )}

          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="mt-4 w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {saving ? "Guardando..." : "Guardar etiquetas"}
          </button>
        </>
      )}
    </div>
  );
}
