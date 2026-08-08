"use client";

import { useState, useEffect, useCallback } from "react";
import { RegisterPaymentDialog } from "@/components/RegisterPaymentDialog";

type BalanceClient = {
  clientId: string;
  name: string;
  phone: string | null;
  balanceUsd: number;
  unpaidAppointments: number;
};

type Payment = {
  id: string;
  amountUsd: number;
  currency: string;
  amountVes: number | null;
  rate: number | null;
  reference: string;
  paidAt: number | null;
  notes: string | null;
};

export function BalancesContent() {
  const [totalUsd, setTotalUsd] = useState(0);
  const [clients, setClients] = useState<BalanceClient[]>([]);
  const [payments, setPayments] = useState<Record<string, Payment[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [registering, setRegistering] = useState<BalanceClient | null>(null);
  const [loading, setLoading] = useState(false);

  const loadBalances = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/balances");
      const data = await res.json();
      setTotalUsd(data.totalUsd ?? 0);
      setClients(Array.isArray(data.clients) ? data.clients : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBalances();
  }, [loadBalances]);

  async function toggleClient(clientId: string) {
    const next = expanded === clientId ? null : clientId;
    setExpanded(next);
    if (next && !payments[next]) {
      const res = await fetch(`/api/payments?userId=${next}`);
      if (res.ok) {
        const data = await res.json();
        setPayments((prev) => ({ ...prev, [next]: Array.isArray(data) ? data : [] }));
      }
    }
  }

  async function deletePayment(clientId: string, paymentId: string) {
    if (!window.confirm("¿Eliminar este pago?")) return;
    await fetch(`/api/payments/${paymentId}`, { method: "DELETE" });
    setPayments((prev) => ({
      ...prev,
      [clientId]: (prev[clientId] ?? []).filter((p) => p.id !== paymentId),
    }));
    await loadBalances();
  }

  const fmtDate = (ts: number | null) =>
    ts
      ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "America/Caracas" }).format(new Date(ts * 1000))
      : "—";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cuentas por cobrar</h1>
        <p className="text-sm text-gray-500">
          Total adeudado:{" "}
          <span className="font-semibold text-gray-900">${totalUsd.toFixed(2)}</span>
        </p>
      </div>

      {loading && clients.length === 0 ? (
        <p className="text-gray-400">Cargando...</p>
      ) : clients.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
          <p className="text-gray-400">No hay cuentas por cobrar pendientes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((c) => (
            <div key={c.clientId} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <button onClick={() => void toggleClient(c.clientId)} className="min-w-0 flex-1 text-left">
                  <p className="font-medium text-gray-900">{c.name}</p>
                  <p className="text-sm text-gray-500">{c.phone ?? "Sin teléfono"}</p>
                  <p className="text-sm text-gray-500">{c.unpaidAppointments} cita(s) sin pagar</p>
                </button>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <p className="rounded-lg bg-pink-light px-3 py-1.5 text-sm font-bold text-gray-900">
                    ${c.balanceUsd.toFixed(2)}
                  </p>
                  <button
                    onClick={() => setRegistering(c)}
                    className="rounded-xl bg-pink-main px-3 py-1.5 text-xs font-medium text-gray-900 hover:bg-pink-light transition-colors"
                  >
                    Registrar pago
                  </button>
                </div>
              </div>

              {expanded === c.clientId && (
                <div className="mt-4 border-t border-gray-100 pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Historial de pagos
                  </p>
                  {!payments[c.clientId] || payments[c.clientId].length === 0 ? (
                    <p className="text-sm text-gray-400">Sin pagos registrados</p>
                  ) : (
                    <div className="space-y-2">
                      {payments[c.clientId].map((p) => (
                        <div key={p.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              ${p.amountUsd.toFixed(2)} {p.currency === "VES" && `· ${p.amountVes?.toFixed(2)} Bs`}
                            </p>
                            <p className="text-xs text-gray-500">
                              Ref: {p.reference} · {fmtDate(p.paidAt)}
                            </p>
                            {p.notes && <p className="text-xs text-gray-400">{p.notes}</p>}
                          </div>
                          <button
                            onClick={() => void deletePayment(c.clientId, p.id)}
                            className="rounded-lg bg-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-300"
                          >
                            Eliminar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {registering && (
        <RegisterPaymentDialog
          clientId={registering.clientId}
          clientName={registering.name}
          onClose={() => setRegistering(null)}
          onSaved={() => {
            setRegistering(null);
            void loadBalances();
          }}
        />
      )}
    </div>
  );
}
