"use client";

import { useState, useEffect, useCallback } from "react";
import { ClientCRMPanel } from "@/components/ClientCRMPanel";

type Client = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  totalVisits: number | null;
  totalRevenue: number | null;
  techNotes: string | null;
  createdAt: number | null;
};

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

export function ClientsContent() {
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Client | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchClients = useCallback(async (query: string) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    const res = await fetch(`/api/clients?${params}`);
    if (res.ok) setClients(await res.json());
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void fetchClients(q), 300);
    return () => clearTimeout(t);
  }, [q, fetchClients]);

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo crear el cliente");
      }
      setShowNew(false);
      setForm({ name: "", email: "", phone: "", address: "" });
      await fetchClients(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500">
            Registro de clientes con visitas, ingresos y notas técnicas.
          </p>
        </div>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="rounded-xl bg-pink-main px-4 py-2 text-sm font-medium text-gray-900 hover:bg-pink-light transition-colors"
        >
          {showNew ? "Cancelar" : "+ Nuevo cliente"}
        </button>
      </div>

      {showNew && (
        <form onSubmit={createClient} className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Nuevo cliente</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nombre *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email (opcional)</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Teléfono</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+58 412 123 4567"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Dirección</label>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>
          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={saving || !form.name}
            className="mt-4 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {saving ? "Creando..." : "Crear cliente"}
          </button>
        </form>
      )}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre, email o teléfono..."
        className="mb-4 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-pink-main focus:outline-none"
      />

      <div className="space-y-3">
        {clients.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(c)}
            className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm hover:border-pink-main hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{c.name}</p>
                <p className="text-sm text-gray-500 truncate">{c.email}</p>
                <p className="text-sm text-gray-500">{c.phone ?? "Sin teléfono"}</p>
                {c.address && <p className="text-sm text-gray-400 truncate">{c.address}</p>}
              </div>
              <div className="flex shrink-0 gap-3 text-center">
                <div className="rounded-lg bg-pink-light px-3 py-1.5">
                  <p className="text-sm font-bold text-gray-900">{c.totalVisits ?? 0}</p>
                  <p className="text-[10px] text-gray-500">Visitas</p>
                </div>
                <div className="rounded-lg bg-pink-light px-3 py-1.5">
                  <p className="text-sm font-bold text-gray-900">${(c.totalRevenue ?? 0).toFixed(2)}</p>
                  <p className="text-[10px] text-gray-500">Ingresos</p>
                </div>
              </div>
            </div>
          </button>
        ))}
        {clients.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
            <p className="text-gray-400">No se encontraron clientes</p>
          </div>
        )}
      </div>

      {selected && (
        <ClientCRMPanel
          clientId={selected.id}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
