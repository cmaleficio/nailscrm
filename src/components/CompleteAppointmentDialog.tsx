"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { todayStr } from "@/lib/time";

type Props = {
  appointmentId: string;
  clientId: string;
  clientName: string;
  serviceName: string;
  servicePrice: number;
  onClose: () => void;
  onCompleted: () => void;
};

type Rate = { rate: number | null; source: string | null };

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

export function CompleteAppointmentDialog({
  appointmentId,
  clientId,
  clientName,
  serviceName,
  servicePrice,
  onClose,
  onCompleted,
}: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(false);
  const [currency, setCurrency] = useState<"USD" | "VES">("USD");
  const [amountUsd, setAmountUsd] = useState(String(servicePrice));
  const [amountVes, setAmountVes] = useState("");
  const [rate, setRate] = useState<Rate>({ rate: null, source: null });
  const [manualRate, setManualRate] = useState("");
  const [reference, setReference] = useState("");
  const [paidDate, setPaidDate] = useState(todayStr());
  const [esmalters, setEsmalters] = useState<{ id: string; name: string; category: string | null; subcategory: string | null; stock: number; isExhausted: number }[]>([]);
  const [usageSel, setUsageSel] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/exchange-rate")
      .then((r) => r.json())
      .then((data) => setRate(data))
      .catch(() => {});
    fetch("/api/inventory/items")
      .then((r) => r.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setEsmalters(arr.filter((i: { category?: string | null }) => !!i.category));
      })
      .catch(() => {});
  }, []);

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;
    setFiles((prev) => [...prev, ...selected]);
    setPreviews((prev) => [...prev, ...selected.map((f) => URL.createObjectURL(f))]);
    e.target.value = "";
  }

  function removeAt(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
    setPreviews((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function confirm() {
    setSaving(true);
    setError("");
    try {
      const urls: string[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const up = await fetch("/api/upload", { method: "POST", body: formData });
        if (!up.ok) throw new Error("No se pudo subir una foto");
        const data = await up.json();
        urls.push(data.url);
      }
      const usage = Object.entries(usageSel)
        .filter((entry) => Number(entry[1]) > 0)
        .map(([inventoryItemId, quantity]) => ({ inventoryItemId, quantity: Number(quantity) }));
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", finalPhotos: urls, usage }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo completar la cita");
      }

      if (paid) {
        const effectiveRate = currency === "VES" ? parseFloat(manualRate || String(rate.rate || "")) : null;
        if (currency === "VES" && (!effectiveRate || effectiveRate <= 0)) {
          throw new Error("Escribe la tasa del día");
        }
        const body: Record<string, unknown> = {
          userId: clientId,
          appointmentId,
          currency,
          reference,
          paidAt: Math.floor(
            new Date(`${paidDate}T00:00:00-04:00`).getTime() / 1000
          ),
        };
        if (currency === "USD") body.amountUsd = parseFloat(amountUsd) || 0;
        else {
          body.amountVes = parseFloat(amountVes) || 0;
          body.rate = effectiveRate;
        }
        const payRes = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!payRes.ok) {
          const data = await payRes.json().catch(() => ({}));
          throw new Error(data.error || "No se pudo registrar el pago");
        }
      }
      onCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">Completar cita</h3>
        <p className="mt-1 text-sm text-gray-500">
          {clientName} · {serviceName} · ${servicePrice.toFixed(2)}
        </p>

        <div className="mt-5">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            ¿Quieres subir fotos del resultado?
          </label>
          <p className="mb-3 text-xs text-gray-400">
            Puedes subir varias fotos. Se publicarán automáticamente en el muro de inspiración.
          </p>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Subir fotos
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFiles}
            />
          </label>
          {previews.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {previews.map((p, i) => (
                <div key={p} className="relative">
                  <Image src={p} alt={`Foto ${i + 1}`} width={64} height={64} className="h-16 w-16 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-xs text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 rounded-xl border border-gray-200 p-4">
          <p className="mb-1 text-sm font-medium text-gray-700">Productos usados (esmaltes)</p>
          <p className="mb-3 text-xs text-gray-400">
            Marca qué esmaltes se usaron en esta cita para saber cuántos usos te duran.
          </p>
          {esmalters.length === 0 ? (
            <p className="text-sm text-gray-400">No hay esmaltes con categoría registrados.</p>
          ) : (
            (() => {
              const byCat: Record<string, { id: string; name: string; subcategory: string | null; stock: number; isExhausted: number }[]> = {};
              for (const e of esmalters) {
                const key = e.category ?? "Otros";
                (byCat[key] ??= []).push(e);
              }
              return Object.entries(byCat).map(([cat, items]) => (
                <div key={cat} className="mb-3">
                  <p className="mb-1 text-xs font-semibold uppercase text-gray-500">{cat}</p>
                  {items.map((e) => (
                    <div key={e.id} className="mb-1 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={usageSel[e.id] !== undefined}
                        onChange={(ev) => {
                          const next = { ...usageSel };
                          if (ev.target.checked) next[e.id] = "1";
                          else delete next[e.id];
                          setUsageSel(next);
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-pink-main focus:ring-pink-main"
                      />
                      <span className="min-w-0 flex-1 text-sm text-gray-700">
                        {e.subcategory ? `${e.subcategory} — ` : ""}{e.name}
                        {e.isExhausted === 1 ? <span className="ml-1 text-xs text-red-500">Agotado</span> : null}
                      </span>
                      {usageSel[e.id] !== undefined && (
                        <input
                          type="number"
                          min="0"
                          value={usageSel[e.id]}
                          onChange={(ev) => setUsageSel((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                          className="w-16 rounded-xl border border-gray-200 px-2 py-1 text-sm"
                        />
                      )}
                    </div>
                  ))}
                </div>
              ));
            })()
          )}
        </div>

        <div className="mt-5 rounded-xl border border-gray-200 p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={paid}
              onChange={(e) => setPaid(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-pink-main focus:ring-pink-main"
            />
            ¿Pagó en el momento?
          </label>
          {paid && (
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
                <div>
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
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Número de referencia *
                </label>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Ej: 00012345"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Fecha del pago</label>
                <input
                  type="date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
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
            onClick={confirm}
            disabled={saving}
            className="flex-1 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Completando..." : "Confirmar completado"}
          </button>
        </div>
      </div>
    </div>
  );
}
