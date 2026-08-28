"use client";

import { useState, useEffect } from "react";

type RateRow = {
  id: string;
  date: string;
  rate: number;
  source: "bcv" | "manual";
  createdAt: number;
};

const inputCls =
  "rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

export function ExchangeRatesContent() {
  const [rows, setRows] = useState<RateRow[]>([]);
  const [todayRate, setTodayRate] = useState<number | null>(null);
  const [todaySource, setTodaySource] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newRate, setNewRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/exchange-rate")
      .then((r) => r.json())
      .then((data) => {
        if (data.rows && Array.isArray(data.rows)) {
          setRows(data.rows);
        }
      })
      .catch(() => {});
    fetch("/api/exchange-rate/current")
      .then((r) => r.json())
      .then((data) => {
        setTodayRate(data.rate ?? null);
        setTodaySource(data.source ?? null);
      })
      .catch(() => {});
  }, []);

  async function saveRate() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      if (!newDate || !newRate || Number(newRate) <= 0) {
        throw new Error("Fecha y tasa mayor a 0 son obligatorios");
      }
      const res = await fetch("/api/exchange-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newDate, rate: Number(newRate) }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "No se pudo guardar la tasa");
      }
      setNewDate("");
      setNewRate("");
      setSaved(true);
      const data = await fetch("/api/exchange-rate").then((r) => r.json());
      setRows(data.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRate(id: string) {
    if (!confirm("¿Eliminar esta tasa?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/exchange-rate/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo eliminar");
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError("Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  }

  const sortedRows = [...rows].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tasas BCV</h1>
        <p className="text-sm text-gray-500">Tasa del día y gestión de fechas anteriores</p>
      </div>

      {todayRate && (
        <div className="mb-6 rounded-xl bg-pink-50 border border-pink-100 p-4">
          <p className="text-sm text-gray-700">
            <span className="font-semibold">Tasa de hoy:</span>{" "}
            <span className="text-pink-main font-bold">{todayRate.toFixed(2)} Bs/US$</span>{" "}
            <span className="text-gray-400">({todaySource})</span>
          </p>
        </div>
      )}

      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Registrar tasa manual</h2>
        <div className="flex flex-wrap gap-3">
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className={inputCls}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={newRate}
            onChange={(e) => setNewRate(e.target.value)}
            placeholder="Tasa Bs/US$"
            className={inputCls}
          />
          <button
            onClick={saveRate}
            disabled={saving || !newDate || !newRate}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {saving ? "Guardando..." : "Guardar tasa"}
          </button>
        </div>
        {saved && (
          <p className="mt-2 text-sm text-green-600">Tasa guardada correctamente</p>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Fecha</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Tasa (Bs/US$)</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Fuente</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Acción</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  Sin tasas registradas
                </td>
              </tr>
            ) : (
              sortedRows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{r.date}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{r.rate.toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-500">{r.source}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteRate(r.id)}
                      disabled={deletingId === r.id}
                      className="text-red-500 hover:text-red-700 disabled:opacity-40 text-xs"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}