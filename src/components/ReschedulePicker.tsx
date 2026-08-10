"use client";

import { useState, useEffect } from "react";

type Props = {
  appointmentId: string;
  serviceId: string;
  currentStartTime: number;
  currentStatus: string;
  currentDate: string;
  currentTime: string;
  onClose: () => void;
  onRescheduled: () => void;
};

export function ReschedulePicker({
  appointmentId,
  serviceId,
  currentStartTime,
  currentStatus,
  currentDate,
  currentTime,
  onClose,
  onRescheduled,
}: Props) {
  const [date, setDate] = useState(
    new Intl.DateTimeFormat("fr-CA", {
      timeZone: "America/Caracas",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(currentStartTime * 1000))
  );
  const [slots, setSlots] = useState<
    { hour: number; minute: number; label: string; available: boolean }[]
  >([]);
  const [selectedTs, setSelectedTs] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    fetch(`/api/slots?date=${date}&serviceId=${serviceId}`)
      .then((r) => r.json())
      .then((data) => {
        setSelectedTs(null);
        setSlots(data.slots || []);
      })
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [date, serviceId]);

  function pickSlot(hour: number, minute: number) {
    const ts =
      Math.floor(
        new Date(date + "T00:00:00-04:00").getTime() / 1000
      ) +
      hour * 3600 +
      minute * 60;
    setSelectedTs(ts);
  }

  async function handleSave() {
    if (!selectedTs) {
      setError("Selecciona un nuevo horario");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startTime: selectedTs, status: currentStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo reprogramar");
      }
      onRescheduled();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al reprogramar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Reprogramar cita</h3>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-gray-400 hover:bg-gray-100"
          >
            ×
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-500">
          Cita actual: {currentDate} · {currentTime}
        </p>

        <label className="mb-1 block text-sm font-medium text-gray-700">
          Nueva fecha
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          min={new Date().toISOString().split("T")[0]}
          className="mb-4 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
        />

        <label className="mb-1 block text-sm font-medium text-gray-700">
          Nuevo horario
        </label>
        {loading ? (
          <p className="text-sm text-gray-400">Cargando horarios...</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-gray-400">No hay horarios disponibles</p>
        ) : (
          <div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto pb-2">
            {slots.map((slot) => (
              <button
                key={slot.label}
                disabled={!slot.available}
                onClick={() => pickSlot(slot.hour, slot.minute)}
                className={`rounded-lg border py-2 text-sm transition-colors ${
                  selectedTs ===
                  Math.floor(new Date(date + "T00:00:00-04:00").getTime() / 1000) +
                    slot.hour * 3600 +
                    slot.minute * 60
                    ? "border-pink-main bg-pink-light font-medium"
                    : slot.available
                      ? "border-gray-200 bg-white text-gray-700 hover:border-pink-main"
                      : "cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300"
                }`}
              >
                {slot.label}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedTs || saving}
            className="flex-1 rounded-xl bg-pink-main px-4 py-2 text-sm font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}