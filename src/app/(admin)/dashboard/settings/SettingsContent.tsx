"use client";

import { useState, useEffect } from "react";

type Day = {
  dayOfWeek: number;
  isOpen: boolean;
  startTime: string;
  endTime: string;
};

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const TIME_OPTIONS: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

const inputCls =
  "rounded-xl border border-gray-200 px-2 py-1.5 text-sm focus:border-pink-main focus:outline-none";

export function SettingsContent() {
  const [hours, setHours] = useState<Day[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/working-hours")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setHours(data);
      })
      .catch(() => {});
  }, []);

  function updateDay(dayOfWeek: number, patch: Partial<Day>) {
    setHours((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d))
    );
  }

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/working-hours", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours }),
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

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
          <p className="text-sm text-gray-500">Horario de trabajo por día de la semana</p>
        </div>
        <a
          href="/dashboard/settings/navigation"
          className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Menú de navegación
        </a>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="space-y-3">
          {hours.map((d) => (
            <div key={d.dayOfWeek} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={d.isOpen}
                  onChange={(e) => updateDay(d.dayOfWeek, { isOpen: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-pink-main focus:ring-pink-main"
                />
                {DAY_LABELS[d.dayOfWeek]}
              </label>
              {d.isOpen ? (
                <div className="flex items-center gap-2">
                  <select
                    value={d.startTime}
                    onChange={(e) => updateDay(d.dayOfWeek, { startTime: e.target.value })}
                    className={inputCls}
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <span className="text-sm text-gray-400">a</span>
                  <select
                    value={d.endTime}
                    onChange={(e) => updateDay(d.dayOfWeek, { endTime: e.target.value })}
                    className={inputCls}
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="text-sm text-gray-400">Cerrado</span>
              )}
            </div>
          ))}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        {saved && (
          <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600">
            Horario guardado
          </p>
        )}

        <button
          onClick={save}
          disabled={saving || hours.length === 0}
          className="mt-4 w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {saving ? "Guardando..." : "Guardar horario"}
        </button>
      </div>
    </div>
  );
}
