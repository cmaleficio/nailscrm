"use client";

import { useState } from "react";

type Props = {
  item: { id: string; name: string; avgCost: number; unit: string };
  onClose: () => void;
  onSaved: () => void;
};

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

export function EditCostDialog({ item, onClose, onSaved }: Props) {
  const [newCost, setNewCost] = useState(item.avgCost.toString());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    const parsed = parseFloat(newCost);
    if (isNaN(parsed) || parsed < 0) {
      setError("El costo debe ser un número mayor o igual a 0");
      return;
    }
    if (notes.trim().length < 3) {
      setError("Indica el motivo del ajuste (mínimo 3 caracteres)");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/inventory/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avgCost: parsed, costNotes: notes.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar el costo");
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
        <h3 className="text-lg font-semibold text-gray-900">Editar costo · {item.name}</h3>
        <p className="mt-1 text-sm text-gray-500">
          Costo actual: <span className="font-semibold text-gray-700">${item.avgCost.toFixed(2)}</span> {item.unit}
        </p>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">Nuevo costo (USD)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={newCost}
            onChange={(e) => setNewCost(e.target.value)}
            placeholder="0.00"
            className={inputCls}
          />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">Motivo del ajuste</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Motivo del ajuste (obligatorio)"
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
            className="flex-1 rounded-xl bg-pink-main px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-colors"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
