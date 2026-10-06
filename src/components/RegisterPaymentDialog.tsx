"use client";

import { useState, useEffect } from "react";
import { todayStr, dateToDayStartTs } from "@/lib/time";
import { previewPayment, paymentKindLabel, PAYMENT_EPS } from "@/lib/payment-split";

type Props = {
  clientId: string;
  clientName: string;
  onClose: () => void;
  onSaved: () => void;
};

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

export function RegisterPaymentDialog({ clientId, clientName, onClose, onSaved }: Props) {
  const [amountVes, setAmountVes] = useState("");
  const [dateRate, setDateRate] = useState<{ rate: number | null; source: string | null }>({ rate: null, source: null });
  const [manualRate, setManualRate] = useState("");
  const [reference, setReference] = useState("");
  const [paidDate, setPaidDate] = useState(todayStr());
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Deuda y pagado actuales de la clienta, para poder mostrar qué hace este
  // pago con la deuda antes de guardarlo.
  const [account, setAccount] = useState<{ dueUsd: number; paidUsd: number } | null>(null);
  const [confirmCredit, setConfirmCredit] = useState(false);

  useEffect(() => {
    let alive = true;
    // `/api/balances` es la misma fuente que la lista de cuentas por cobrar y
    // exige el MISMO permiso que registrar el pago, así que nunca falla aquí.
    fetch("/api/balances")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data || !Array.isArray(data.clients)) return;
        const row = data.clients.find((c: { clientId: string }) => c.clientId === clientId);
        setAccount({ dueUsd: row?.dueUsd ?? 0, paidUsd: row?.paidUsd ?? 0 });
      })
      .catch(() => {
        if (alive) setAccount(null);
      });
    return () => {
      alive = false;
    };
  }, [clientId]);

  const ves = parseFloat(amountVes);
  const rate = dateRate.rate !== null ? dateRate.rate : parseFloat(manualRate);
  const amountUsd =
    ves > 0 && rate > 0 ? Math.round((ves / rate) * 100) / 100 : 0;

  const preview = account && amountUsd > 0 ? previewPayment(account.dueUsd, account.paidUsd, amountUsd) : null;
  const isCredit = !!preview && preview.creditUsd > PAYMENT_EPS;

  useEffect(() => {
    setConfirmCredit(false);
  }, [amountUsd]);

  useEffect(() => {
    if (!paidDate) return;
    const dateStr = paidDate;
    fetch(`/api/exchange-rate/by-date?date=${dateStr}`)
      .then((r) => r.json())
      .then((data) => {
        setDateRate({ rate: data.rate ?? null, source: data.source ?? null });
        if (data.rate === null) {
          setManualRate("");
        }
      })
      .catch(() => setDateRate({ rate: null, source: null }));
  }, [paidDate]);

  async function handleUpload(file: File) {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("kind", "payment");
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
      const effectiveRate = dateRate.rate !== null ? dateRate.rate : (parseFloat(manualRate) || null);
      if (!effectiveRate || effectiveRate <= 0) {
        throw new Error("No hay tasa BCV para esta fecha. Ingrésala en Tasas.");
      }
      if (!amountVes || parseFloat(amountVes) <= 0) {
        throw new Error("Ingresa el monto en Bs");
      }
      const body: Record<string, unknown> = {
        userId: clientId,
        currency: "VES",
        amountVes: parseFloat(amountVes),
        rate: effectiveRate,
        reference,
        paidAt: dateToDayStartTs(paidDate),
        notes,
      };
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
          <label className="mb-1 block text-xs font-medium text-gray-600">Monto en Bs</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amountVes}
            onChange={(e) => setAmountVes(e.target.value)}
            placeholder="Monto en Bs"
            className={inputCls}
          />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">Tasa del día</label>
          {dateRate.rate !== null ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              <span className="font-semibold text-pink-main">
                {dateRate.rate.toFixed(2)} Bs/US$
              </span>
              <span className="ml-2 text-xs text-gray-500">
                (BCV {paidDate} · {dateRate.source})
              </span>
            </div>
          ) : (
            <>
              <p className="mb-1 text-xs text-amber-600">
                Sin tasa BCV registrada para esta fecha. Ingrésala manualmente:
              </p>
              <input
                type="number"
                min="0"
                step="0.01"
                value={manualRate}
                onChange={(e) => setManualRate(e.target.value)}
                placeholder="Tasa Bs/US$"
                className={inputCls}
              />
            </>
          )}
          {dateRate.rate !== null && parseFloat(amountVes) > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              Total: <span className="font-semibold text-gray-700">${(parseFloat(amountVes) / dateRate.rate).toFixed(2)}</span>
            </p>
          )}
          {dateRate.rate === null && parseFloat(manualRate) > 0 && parseFloat(amountVes) > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              Total: <span className="font-semibold text-gray-700">${(parseFloat(amountVes) / parseFloat(manualRate)).toFixed(2)}</span>
            </p>
          )}
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">Número de referencia</label>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Ej: 00012345"
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

        {preview && (
          <div
            className={`mt-4 rounded-xl border p-3 ${
              isCredit ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-gray-50"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Qué va a hacer este pago
            </p>
            <p className="mt-1 text-sm text-gray-700">
              Deuda actual:{" "}
              <span className="font-semibold">${preview.remainingUsd.toFixed(2)}</span>
            </p>
            <p className="mt-1 text-sm text-gray-700">
              <span className={`font-semibold ${isCredit ? "text-amber-700" : "text-gray-900"}`}>
                {paymentKindLabel(preview.kind)}
              </span>{" "}
              de ${amountUsd.toFixed(2)}
              {preview.appliedUsd > 0 && <> → cubre ${preview.appliedUsd.toFixed(2)}</>}
              {isCredit && <> y deja ${preview.creditUsd.toFixed(2)} de saldo a favor</>}
            </p>
            {preview.nextBalanceUsd <= PAYMENT_EPS && !isCredit && (
              <p className="mt-1 text-xs text-green-700">Queda sin deuda.</p>
            )}
            {isCredit && (
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-amber-800">
                <input
                  type="checkbox"
                  checked={confirmCredit}
                  onChange={(e) => setConfirmCredit(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-amber-600"
                />
                <span>
                  Entiendo que ${preview.creditUsd.toFixed(2)} queda como <strong>saldo a favor</strong> de{" "}
                  {clientName} (anticipo para su próxima visita).
                </span>
              </label>
            )}
          </div>
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
            disabled={saving || (isCredit && !confirmCredit)}
            className="flex-1 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Guardando..." : "Guardar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}
