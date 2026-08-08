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
  appointmentId: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  onClose: () => void;
};

type Purchase = {
  id: string;
  serviceName: string;
  serviceDescription: string | null;
  servicePrice: number;
  serviceDurationMins: number;
};

export function ClientCRMPanel({
  clientId,
  appointmentId,
  serviceName,
  appointmentDate,
  appointmentTime,
  onClose,
}: Props) {
  const [client, setClient] = useState<ClientData | null>(null);
  const [techNotes, setTechNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [editingPurchase, setEditingPurchase] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState<Purchase | null>(null);
  const [purchaseSaving, setPurchaseSaving] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");
  const [purchaseSuccess, setPurchaseSuccess] = useState("");

  useEffect(() => {
    fetch(`/api/clients/${clientId}`)
      .then((r) => r.json())
      .then((data) => {
        setClient(data);
        setTechNotes(data.techNotes || "");
      });
  }, [clientId]);

  useEffect(() => {
    fetch(`/api/purchases?appointmentId=${appointmentId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.id) {
          setPurchase(data);
          setPurchaseForm(data);
        }
      })
      .catch(() => {});
  }, [appointmentId]);

  async function saveNotes() {
    setSaving(true);
    await fetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ techNotes }),
    });
    setSaving(false);
  }

  async function savePurchase() {
    if (!purchase || !purchaseForm) return;
    setPurchaseSaving(true);
    setPurchaseError("");
    setPurchaseSuccess("");
    try {
      const res = await fetch(`/api/purchases/${purchase.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceName: purchaseForm.serviceName,
          serviceDescription: purchaseForm.serviceDescription,
          servicePrice: parseFloat(String(purchaseForm.servicePrice)),
          serviceDurationMins: parseInt(String(purchaseForm.serviceDurationMins), 10),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar");
      }
      setPurchase(purchaseForm);
      setEditingPurchase(false);
      setPurchaseSuccess("Servicio adquirido actualizado");
    } catch (e) {
      setPurchaseError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setPurchaseSaving(false);
    }
  }

  async function syncPurchaseToCatalog() {
    if (!purchase) return;
    setPurchaseSaving(true);
    setPurchaseError("");
    setPurchaseSuccess("");
    try {
      const res = await fetch(`/api/purchases/${purchase.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncFromCatalog: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo sincronizar");
      }
      const fresh = await fetch(`/api/purchases?appointmentId=${appointmentId}`);
      const data = await fresh.json();
      if (data?.id) {
        setPurchase(data);
        setPurchaseForm(data);
      }
      setEditingPurchase(false);
      setPurchaseSuccess("Servicio sincronizado con el catálogo actual");
    } catch (e) {
      setPurchaseError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setPurchaseSaving(false);
    }
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

        {purchase && (
          <div className="mb-6 rounded-xl border border-gray-200 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Servicio adquirido
            </p>
            {purchaseSuccess && (
              <p className="mb-2 rounded-lg bg-green-50 px-2 py-1.5 text-xs text-green-600">
                {purchaseSuccess}
              </p>
            )}
            {purchaseError && (
              <p className="mb-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-600">
                {purchaseError}
              </p>
            )}
            {!editingPurchase ? (
              <div>
                <p className="font-medium text-gray-900">{purchase.serviceName}</p>
                {purchase.serviceDescription && (
                  <p className="mt-0.5 text-xs text-gray-500">
                    {purchase.serviceDescription}
                  </p>
                )}
                <p className="mt-1 text-sm text-gray-600">
                  ${purchase.servicePrice.toFixed(2)} ·{" "}
                  {purchase.serviceDurationMins} min
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => setEditingPurchase(true)}
                    className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={syncPurchaseToCatalog}
                    disabled={purchaseSaving}
                    className="rounded-lg bg-pink-light px-3 py-1.5 text-xs font-medium text-pink-700 hover:bg-pink-main disabled:opacity-50 transition-colors"
                  >
                    {purchaseSaving ? "Sincronizando..." : "Usar versión actual del catálogo"}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="space-y-2">
                  <div>
                    <label className="mb-0.5 block text-xs font-medium text-gray-600">
                      Nombre
                    </label>
                    <input
                      value={purchaseForm?.serviceName ?? ""}
                      onChange={(e) =>
                        setPurchaseForm((prev) =>
                          prev ? { ...prev, serviceName: e.target.value } : prev
                        )
                      }
                      className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-pink-main focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-xs font-medium text-gray-600">
                      Descripción
                    </label>
                    <textarea
                      value={purchaseForm?.serviceDescription ?? ""}
                      onChange={(e) =>
                        setPurchaseForm((prev) =>
                          prev
                            ? { ...prev, serviceDescription: e.target.value }
                            : prev
                        )
                      }
                      rows={2}
                      className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-pink-main focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-0.5 block text-xs font-medium text-gray-600">
                        Precio ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={purchaseForm?.servicePrice ?? 0}
                        onChange={(e) =>
                          setPurchaseForm((prev) =>
                            prev
                              ? { ...prev, servicePrice: parseFloat(e.target.value) || 0 }
                              : prev
                          )
                        }
                        className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-pink-main focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-xs font-medium text-gray-600">
                        Duración (min)
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="5"
                        value={purchaseForm?.serviceDurationMins ?? 0}
                        onChange={(e) =>
                          setPurchaseForm((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  serviceDurationMins: parseInt(e.target.value, 10) || 0,
                                }
                              : prev
                          )
                        }
                        className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-pink-main focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={savePurchase}
                    disabled={purchaseSaving}
                    className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  >
                    {purchaseSaving ? "Guardando..." : "Guardar"}
                  </button>
                  <button
                    onClick={() => setEditingPurchase(false)}
                    className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

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
