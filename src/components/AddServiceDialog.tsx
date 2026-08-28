"use client";

import { useState, useEffect } from "react";

type Props = {
  clientId?: string;
  clientName?: string;
  onClose: () => void;
  onSaved: () => void;
};

type Service = {
  id: string;
  name: string;
  price: number;
  durationMins: number;
  isActive?: number;
};

type Client = { id: string; name: string };

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

function nowDateTimeLocal(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}`
  );
}

export function AddServiceDialog({ clientId: propClientId, clientName, onClose, onSaved }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState(propClientId ?? "");
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [completionDate, setCompletionDate] = useState(nowDateTimeLocal());
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setServices(data.filter((s: Service) => s.isActive === 1 || s.isActive === undefined));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (propClientId) return;
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setClients(data as Client[]);
      })
      .catch(() => {});
  }, [propClientId]);

  useEffect(() => {
    if (!serviceId) {
      setPrice("");
      return;
    }
    fetch(`/api/services?id=${serviceId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.price === "number") {
          setPrice(String(data.price));
        }
      })
      .catch(() => {});
  }, [serviceId]);

  async function submit() {
    setError("");
    if (!clientId) {
      setError("Selecciona un cliente");
      return;
    }
    if (!serviceId) {
      setError("Selecciona un servicio");
      return;
    }
    if (!completionDate) {
      setError("Selecciona la fecha y hora");
      return;
    }
    const ts = Math.floor(new Date(completionDate).getTime() / 1000);
    if (!Number.isFinite(ts) || ts <= 0) {
      setError("Fecha inválida");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        userId: clientId,
        serviceId,
        completionDate: ts,
        notes,
      };
      if (price && parseFloat(price) > 0) {
        body.price = parseFloat(price);
      }
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo registrar el servicio");
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
      <div className="relative w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl max-h-[90vh]">
        <h3 className="text-lg font-semibold text-gray-900">Agregar servicio realizado</h3>
        <p className="mt-1 text-sm text-gray-500">
          {clientName ?? "Registra un servicio ya realizado (sin cita previa)."}
        </p>

        {!propClientId && (
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">Cliente</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={inputCls}
            >
              <option value="">Elegir cliente...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

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
          <label className="mb-1 block text-sm font-medium text-gray-700">Fecha y hora</label>
          <input
            type="datetime-local"
            value={completionDate}
            onChange={(e) => setCompletionDate(e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Precio (opcional)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Precio en USD"
            className={inputCls}
          />
          {price && serviceId && services.find((s) => s.id === serviceId) && (
            <p className="mt-1 text-xs text-gray-500">
              Precio base: ${services.find((s) => s.id === serviceId)?.price.toFixed(2)}
            </p>
          )}
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Notas (opcional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas sobre el servicio..."
            rows={2}
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
            className="flex-1 rounded-xl bg-pink-main px-4 py-2 text-sm font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50 transition-colors"
          >
            {saving ? "Guardando..." : "Registrar servicio"}
          </button>
        </div>
      </div>
    </div>
  );
}
