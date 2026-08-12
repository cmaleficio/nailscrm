"use client";

import { useState, useEffect } from "react";
import { todayStr } from "@/lib/time";

type Props = {
  clientId: string;
  clientName: string;
  onClose: () => void;
  onSaved: () => void;
};

type Rate = { rate: number | null; source: string | null };

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

export function RegisterPaymentDialog({ clientId, clientName, onClose, onSaved }: Props) {
  const [currency, setCurrency] = useState<"USD" | "VES">("USD");
  const [amountUsd, setAmountUsd] = useState("");
  const [amountVes, setAmountVes] = useState("");
  const [rate, setRate] = useState<Rate>({ rate: null, source: null });
  const [manualRate, setManualRate] = useState("");
  const [reference, setReference] = useState("");
  const [paidDate, setPaidDate] = useState(todayStr());
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/exchange-rate")
      .then((r) => r.json())
      .then((data) => setRate(data))
      .catch(() => {});
  }, []);

  async function handleUpload(file: File) {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error("No se pudo subir la captura");
      const data = await res.json();
      setPhotoUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error subiendo captura");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setSaving(true);
    setError("");
    try {
      const effectiveRate = currency === "VES" ? parseFloat(manualRate || String(rate.rate || "")) : null;
      if (currency === "VES" && (!effectiveRate || effectiveRate <= 0)) {
        throw new Error("Escribe la tasa del día");
      }
      const body: Record<string, unknown> = {
        userId: clientId,
        currency,
        reference,
        paidAt: Math.floor(new Date(`${paidDate}T00:00:00-04:00`).getTime() / 1000),
        notes,
      };
      if (currency === "USD") body.amountUsd = parseFloat(amountUsd) || 0;
      else {
        body.amountVes = parseFloat(amountVes) || 0;
        body.rate = effectiveRate;
      }
      if (photoUrl) body.photoUrl = photoUrl;
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo registrar el pago");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">Registrar pago</h3>
        <p className="mt-1 text-sm text-gray-500">{clientName}</p>

        <div className="mt-4 flex gap-2">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "USD" | "VES")}
            className={inputCls}
          >
            <option value="USD">$</option>
            <option value="VES">Bs</option>
          </select>
          {currency === "USD" ? (
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountUsd}
              onChange={(e) => setAmountUsd(e.target.value)}
              placeholder="Monto en $"
              className={inputCls}
            />
          ) : (
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountVes}
              onChange={(e) => setAmountVes(e.target.value)}
              placeholder="Monto en Bs"
              className={inputCls}
            />
          )}
        </div>

        {currency === "VES" && (
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-gray-600">Tasa del día</label>
            {rate.rate ? (
              <p className="mb-1 text-xs text-gray-500">
                Tasa BCV: {rate.rate.toFixed(2)} Bs/US$ (puedes corregirla)
              </p>
            ) : (
              <p className="mb-1 text-xs text-amber-600">
                No se pudo obtener la tasa automática. Escribe la tasa manualmente.
              </p>
            )}
            <input
              type="number"
              min="0"
              step="0.01"
              value={manualRate}
              onChange={(e) => setManualRate(e.target.value)}
              placeholder={String(rate.rate ?? "Tasa Bs/US$")}
              className={inputCls}
            />
          </div>
        )}

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">Número de referencia *</label>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Ej: 00012345"
            className={inputCls}
          />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">Fecha del pago</label>
          <input
            type="date"
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">Notas (opcional)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: abono, pago pendiente..."
            className={inputCls}
          />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">Captura (opcional)</label>
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
            }}
            className={inputCls}
          />
          {uploading && <p className="mt-1 text-xs text-gray-500">Subiendo...</p>}
          {photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="Captura" className="mt-2 h-20 w-20 rounded-lg object-cover" />
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Guardando..." : "Guardar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}
