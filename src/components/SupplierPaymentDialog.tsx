"use client";

import { useState, useEffect } from "react";
import { todayStr, dateTimeToTs } from "@/lib/time";

type Props = {
  bill: {
    id: string;
    supplierName?: string | null;
    invoiceNumber?: string | null;
    totalUsd: number;
    paidUsd: number;
    currency: "USD" | "VES";
  };
  onClose: () => void;
  onSaved: () => void;
};

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function SupplierPaymentDialog({ bill, onClose, onSaved }: Props) {
  const pending = round2(Math.max(0, bill.totalUsd - bill.paidUsd));

  const [bankAccounts, setBankAccounts] = useState<{ id: string; bankName: string; accountType: string; accountNumber: string | null; currency: "USD" | "VES"; isActive: number }[]>([]);
  const [currency, setCurrency] = useState<"USD" | "VES">("USD");
  const [amountUsd, setAmountUsd] = useState(bill.currency === "VES" ? "" : String(pending));
  const [amountVes, setAmountVes] = useState("");
  const [rate, setRate] = useState<{ rate: number | null; source: string | null }>({ rate: null, source: null });
  const [bankAccountId, setBankAccountId] = useState("");
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayStr());
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/bank-accounts")
      .then((r) => r.json())
      .then((data) => setBankAccounts(Array.isArray(data) ? data : []))
      .catch(() => {});
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
    if (!photoUrl) {
      setError("La captura del pago es requerida");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const effectiveRate = currency === "VES" ? parseFloat(String(rate.rate ?? "")) : null;
      if (currency === "VES" && (!effectiveRate || effectiveRate <= 0)) {
        throw new Error("Escribe la tasa del día");
      }
      const body: Record<string, unknown> = {
        billId: bill.id,
        bankAccountId: bankAccountId || null,
        currency,
        paymentDate: dateTimeToTs(paymentDate, "00:00"),
        reference: reference.trim(),
        notes: notes.trim(),
        photoUrl,
      };
      if (currency === "VES") {
        body.amountVes = parseFloat(amountVes) || 0;
        body.rate = effectiveRate;
      } else {
        body.amountUsd = parseFloat(amountUsd) || 0;
      }
      const res = await fetch("/api/supplier-payments", {
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
      <div className="absolute inset-0 bg-black/30" onClick={saving ? undefined : onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">Registrar pago a proveedor</h3>
        <p className="mt-1 text-sm text-gray-500">
          {bill.supplierName ?? "Proveedor"} · {bill.invoiceNumber ?? "Sin nº"} · Pendiente{" "}
          <span className="font-semibold text-gray-900">${pending.toFixed(2)}</span>
        </p>

        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
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
                placeholder={`Monto en $ (máx ${pending.toFixed(2)})`}
                className={inputCls}
              />
            ) : (
              <>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountVes}
                  onChange={(e) => setAmountVes(e.target.value)}
                  placeholder="Monto en Bs"
                  className={inputCls}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rate.rate ? String(rate.rate) : ""}
                  onChange={(e) => setRate({ rate: parseFloat(e.target.value) || null, source: "manual" })}
                  placeholder="Tasa Bs/US$"
                  className={inputCls}
                />
              </>
            )}
          </div>

          <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className={inputCls}>
            <option value="">— Sin banco —</option>
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bankName} · {b.currency}
              </option>
            ))}
          </select>

          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Referencia (opcional)"
            className={inputCls}
          />
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className={inputCls}
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas (opcional)"
            className={inputCls}
          />
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Captura del pago *</label>
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
            className="flex-1 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {saving ? "Guardando..." : "Registrar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}
