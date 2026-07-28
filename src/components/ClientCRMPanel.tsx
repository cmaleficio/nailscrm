"use client";

import { useState, useEffect } from "react";
import { getWhatsAppUrl } from "@/lib/whatsapp";

type ClientData = {
  id: string;
  name: string;
  phone: string | null;
  techNotes: string | null;
  totalVisits: number | null;
  totalRevenue: number | null;
  email: string;
};

type Props = {
  clientId: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  onClose: () => void;
};

export function ClientCRMPanel({
  clientId,
  serviceName,
  appointmentDate,
  appointmentTime,
  onClose,
}: Props) {
  const [client, setClient] = useState<ClientData | null>(null);
  const [techNotes, setTechNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/clients/${clientId}`)
      .then((r) => r.json())
      .then((data) => {
        setClient(data);
        setTechNotes(data.techNotes || "");
      });
  }, [clientId]);

  async function saveNotes() {
    setSaving(true);
    await fetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ techNotes }),
    });
    setSaving(false);
  }

  if (!client) return null;

  const whatsappUrl = getWhatsAppUrl(
    client.phone || "",
    client.name,
    serviceName,
    appointmentDate,
    appointmentTime
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white p-6 shadow-xl overflow-y-auto">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{client.name}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-gray-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6 flex gap-4">
          <div className="flex-1 rounded-xl bg-pink-light p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {client.totalVisits ?? 0}
            </p>
            <p className="text-xs text-gray-500">Visitas</p>
          </div>
          <div className="flex-1 rounded-xl bg-pink-light p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">
              ${(client.totalRevenue ?? 0).toFixed(2)}
            </p>
            <p className="text-xs text-gray-500">Ingresos</p>
          </div>
        </div>

        <div className="mb-6">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Notas técnicas
          </label>
          <textarea
            value={techNotes}
            onChange={(e) => setTechNotes(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:border-pink-main focus:outline-none"
            placeholder="Ej: alergia al acrílico, prefiere gel..."
          />
          <button
            onClick={saveNotes}
            disabled={saving}
            className="mt-2 rounded-xl bg-gray-900 px-4 py-1.5 text-xs text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {saving ? "Guardando..." : "Guardar notas"}
          </button>
        </div>

        {client.phone && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-3 text-sm font-medium text-white hover:bg-green-600 transition-colors"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Enviar WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
