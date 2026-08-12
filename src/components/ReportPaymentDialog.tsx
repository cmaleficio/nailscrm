"use client";

import { useState, useEffect } from "react";

type Props = {
  balanceUsd: number;
  appointments: { id: string; serviceName: string; startTime: number }[];
  onClose: () => void;
  onSaved: () => void;
};

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

export function ReportPaymentDialog({ balanceUsd, appointments, onClose, onSaved }: Props) {
  const [appointmentId, setAppointmentId] = useState("");
  const [amountVes, setAmountVes] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [rate, setRate] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/exchange-rate/current")
      .then((r) => r.json())
      .then((data) => setRate(data.rate ?? null))
      .catch(() => setRate(null));
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
    const v = parseFloat(amountVes);
    if (!Number.isFinite(v) || v <= 0) {
      setError("Escribe un monto en Bs mayor a 0");
      return;
    }
    if (!photoUrl) {
      setError("Adjunta la captura de la transferencia");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/payment-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: appointmentId || null, amountVes: v, photoUrl }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo reportar el pago");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={saving ? undefined : onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">Reportar pago</h3>
        <p className="mt-1 text-sm text-gray-500">
          Saldo pendiente:{" "}
          <span className="font-semibold text-gray-900">${balanceUsd.toFixed(2)}</span>
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Cita (opcional)</label>
            <select value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)} className={inputCls}>
              <option value="">— Sin asignar —</option>
              {appointments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.serviceName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Monto en Bs *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountVes}
              onChange={(e) => setAmountVes(e.target.value)}
              placeholder="Ej: 1500"
              className={inputCls}
            />
            {rate && (
              <p className="mt-1 text-xs text-gray-500">
                Tasa BCV del día: {rate.toFixed(2)} Bs/US$ → ≈ $
                {((parseFloat(amountVes) || 0) / rate).toFixed(2)}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Captura de la transferencia *</label>
            <input
              type="file"
              accept="image/*"
              disabled={uploading || saving}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
              }}
              className={inputCls}
            />
            {uploading && <p className="mt-1 text-xs text-gray-500">Subiendo...</p>}
            {photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="Captura" className="mt-2 h-24 w-24 rounded-lg object-cover" />
            )}
          </div>
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <p className="mt-3 text-xs text-gray-400">
          El salón debe aprobar tu pago para que se aplique a tu cuenta.
        </p>

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} disabled={saving} className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
            Cancelar
          </button>
          <button onClick={submit} disabled={saving || uploading} className="flex-1 rounded-xl bg-pink-main px-4 py-2 text-sm font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50 transition-colors">
            {saving ? "Enviando..." : "Reportar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}
