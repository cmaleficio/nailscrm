"use client";

import { useState, useEffect, useCallback } from "react";
import { todayStr, dateTimeToTs } from "@/lib/time";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
};

type Service = { id: string; name: string; price: number; durationMins: number; isGroup: number };
type Client = { id: string; name: string; phone: string | null };
type Slot = { label: string; available: boolean };

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

export function CourseSessionDialog({ open, onOpenChange, onCreated }: Props) {
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/services")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setServices(data.filter((s: Service) => s.isGroup === 1));
        }
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!serviceId || !date) return;
    fetch(`/api/slots?date=${date}&serviceId=${serviceId}`)
      .then((r) => r.json())
      .then((data) => {
        setSlots(data.slots ?? []);
        setSelectedSlot("");
      })
      .catch(() => {});
  }, [serviceId, date]);

  const searchClients = useCallback(async (q: string) => {
    const res = await fetch(`/api/clients?q=${encodeURIComponent(q)}`);
    if (res.ok) setClients(await res.json());
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void searchClients(query), 300);
    return () => clearTimeout(t);
  }, [query, searchClients]);

  function toggleClient(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedService = services.find((s) => s.id === serviceId);
  const total = selectedService ? selectedService.price * selectedIds.size : 0;

  async function submit() {
    if (!serviceId || !selectedSlot || selectedIds.size === 0) return;
    setSaving(true);
    setError("");
    try {
      const startTime = dateTimeToTs(date, selectedSlot);
      const res = await fetch("/api/course-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          startTime,
          clientIds: Array.from(selectedIds),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo crear la sesión de curso");
      }
      onCreated?.();
      setServiceId("");
      setSelectedSlot("");
      setSelectedIds(new Set());
      setQuery("");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={() => onOpenChange(false)} />
      <div className="relative w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl max-h-[90vh]">
        <h3 className="text-lg font-semibold text-gray-900">Nueva sesión de curso</h3>
        <p className="mt-1 text-sm text-gray-500">
          Crea una sesión grupal y selecciona los alumnos que asistirán.
        </p>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Servicio (curso)</label>
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className={inputCls}
          >
            <option value="">Elegir curso...</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — ${s.price.toFixed(2)} · {s.durationMins} min
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />
        </div>

        {serviceId && (
          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">Hora</label>
            {slots.length === 0 ? (
              <p className="text-sm text-gray-400">No hay horarios disponibles ese día</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    disabled={!s.available}
                    onClick={() => setSelectedSlot(s.label)}
                    className={`rounded-xl border px-3 py-1.5 text-sm transition-colors disabled:opacity-30 ${
                      selectedSlot === s.label
                        ? "border-pink-main bg-pink-main text-gray-900"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Alumnos</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente por nombre, email o teléfono..."
            className={inputCls}
          />
          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {clients.map((c) => (
              <label
                key={c.id}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  selectedIds.has(c.id)
                    ? "bg-pink-main text-gray-900"
                    : "bg-gray-50 hover:bg-gray-100"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(c.id)}
                  onChange={() => toggleClient(c.id)}
                  className="h-4 w-4"
                />
                <span className="font-medium">{c.name}</span>
                {c.phone && <span className="ml-auto text-xs text-gray-500">{c.phone}</span>}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {selectedIds.size} seleccionado{selectedIds.size === 1 ? "" : "s"} ·{" "}
            {selectedService ? `$${total.toFixed(2)} total` : ""}
          </p>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving || !serviceId || !selectedSlot || selectedIds.size === 0}
            className="flex-1 rounded-xl bg-pink-main px-4 py-2 text-sm font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50 transition-colors"
          >
            {saving ? "Creando..." : `Crear sesión (${selectedIds.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
