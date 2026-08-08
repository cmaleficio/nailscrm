"use client";

import { useState, useEffect, useCallback } from "react";
import { todayStr, dateTimeToTs } from "@/lib/time";

type Props = {
  onClose: () => void;
  onCreated: () => void;
};

type Service = { id: string; name: string; price: number; durationMins: number };
type Client = { id: string; name: string; phone: string | null };
type Slot = { label: string; available: boolean };

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

export function NewAppointmentDialog({ onClose, onCreated }: Props) {
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", phone: "" });
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setServices(data);
      })
      .catch(() => {});
  }, []);

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

  async function createClient() {
    if (!newForm.name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newForm.name, phone: newForm.phone }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo crear el cliente");
      }
      const data = await res.json();
      setClientId(data.id);
      setShowNew(false);
      setNewForm({ name: "", phone: "" });
      await searchClients(newForm.name || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setCreating(false);
    }
  }

  async function submit() {
    if (!clientId || !serviceId || !selectedSlot) return;
    setSaving(true);
    setError("");
    try {
      const startTime = dateTimeToTs(date, selectedSlot);
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, serviceId, startTime }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo crear la cita");
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl max-h-[90vh]">
        <h3 className="text-lg font-semibold text-gray-900">Nueva cita</h3>
        <p className="mt-1 text-sm text-gray-500">
          Crea una cita para un cliente, incluso si no está registrado.
        </p>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Cliente</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, email o teléfono..."
            className={inputCls}
          />
          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {clients.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setClientId(c.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  clientId === c.id
                    ? "bg-pink-main text-gray-900"
                    : "bg-gray-50 hover:bg-gray-100"
                }`}
              >
                <span className="font-medium">{c.name}</span>
                {c.phone && <span className="ml-2 text-xs text-gray-500">{c.phone}</span>}
              </button>
            ))}
          </div>
          {!showNew ? (
            <button
              type="button"
              onClick={() => setShowNew(true)}
              className="mt-2 text-sm font-medium text-pink-700 hover:text-pink-600"
            >
              + Crear nuevo cliente
            </button>
          ) : (
            <div className="mt-2 space-y-2 rounded-xl border border-gray-200 p-3">
              <input
                value={newForm.name}
                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                placeholder="Nombre *"
                className={inputCls}
              />
              <input
                value={newForm.phone}
                onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
                placeholder="Teléfono"
                className={inputCls}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={createClient}
                  disabled={creating || !newForm.name.trim()}
                  className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {creating ? "Creando..." : "Crear y seleccionar"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNew(false)}
                  className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Servicio</label>
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className={inputCls}
          >
            <option value="">Elegir servicio...</option>
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
            disabled={saving || !clientId || !serviceId || !selectedSlot}
            className="flex-1 rounded-xl bg-pink-main px-4 py-2 text-sm font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50 transition-colors"
          >
            {saving ? "Creando..." : "Crear cita"}
          </button>
        </div>
      </div>
    </div>
  );
}
