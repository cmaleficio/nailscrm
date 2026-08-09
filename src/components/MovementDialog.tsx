"use client";

import { useState } from "react";

type Props = {
  item: { id: string; name: string; stock: number; unit: string };
  onClose: () => void;
  onSaved: () => void;
};

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

export function MovementDialog({ item, onClose, onSaved }: Props) {
  const [kind, setKind] = useState<"out" | "adjust">("out");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!notes.trim() && kind === "adjust") {
      setError("El motivo es obligatorio en ajustes");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = { kind, quantity: Number(quantity), notes: notes.trim() };
      const res = await fetch(`/api/inventory/items/${item.id}/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo registrar el movimiento");
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
        <h3 className="text-lg font-semibold text-gray-900">
          {kind === "out" ? "Registrar salida" : "Ajustar stock"} · {item.name}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Stock actual: <span className="font-semibold text-gray-900">{item.stock} {item.unit}</span>
        </p>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setKind("out")}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              kind === "out" ? "bg-pink-main text-gray-900" : "bg-gray-100 text-gray-600"
            }`}
          >
            Salida
          </button>
          <button
            onClick={() => setKind("adjust")}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              kind === "adjust" ? "bg-pink-main text-gray-900" : "bg-gray-100 text-gray-600"
            }`}
          >
            Ajuste
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <input
            type="number"
            min="0"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={kind === "out" ? "Cantidad a retirar" : "Stock objetivo"}
            className={inputCls}
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={kind === "adjust" ? "Motivo del ajuste (obligatorio)" : "Motivo (opcional)"}
            className={inputCls}
          />
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
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
