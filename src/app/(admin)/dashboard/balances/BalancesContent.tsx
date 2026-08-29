"use client";

import { useState, useEffect, useCallback } from "react";
import { RegisterPaymentDialog } from "@/components/RegisterPaymentDialog";
import { AddServiceDialog } from "@/components/AddServiceDialog";

type BalanceItem = {
  id: string;
  serviceName: string;
  price: number;
  financialStatus: string;
  completionDate: number | null;
  startTime: number | null;
};

type BalanceClient = {
  clientId: string;
  name: string;
  phone: string | null;
  balanceUsd: number;
  unpaidAppointments: number;
  items: BalanceItem[];
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

type Receipt = {
  id: string;
  clientId: string;
  clientName: string | null;
  amountVes: number;
  rate: number;
  amountUsd: number;
  photoUrl: string;
  status: string;
  reviewNotes: string | null;
  paymentId: string | null;
  createdAt: number;
};

export function BalancesContent() {
  const [totalUsd, setTotalUsd] = useState(0);
  const [clients, setClients] = useState<BalanceClient[]>([]);
  const [payments, setPayments] = useState<Record<string, Payment[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [registering, setRegistering] = useState<BalanceClient | null>(null);
  const [addingFor, setAddingFor] = useState<BalanceClient | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "partial" | "paid">("all");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"balances" | "receipts">("balances");
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [receiptFilter, setReceiptFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

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

  const loadReceipts = useCallback(async () => {
    const params = new URLSearchParams();
    if (receiptFilter !== "all") params.set("status", receiptFilter);
    const res = await fetch(`/api/payment-receipts?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setReceipts(Array.isArray(data) ? data : []);
    }
  }, [receiptFilter]);

  useEffect(() => {
    void loadBalances();
  }, [loadBalances]);

  useEffect(() => {
    if (tab === "receipts") void loadReceipts();
  }, [tab, loadReceipts]);

  async function reviewReceipt(id: string, action: "approve" | "reject") {
    const notes = action === "reject" ? window.prompt("Motivo del rechazo:") ?? "" : "";
    const res = await fetch(`/api/payment-receipts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, notes }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error || "No se pudo revisar la captura");
    }
    await loadReceipts();
    await loadBalances();
  }

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

  async function deletePurchase(clientId: string, purchaseId: string) {
    if (!window.confirm("¿Eliminar este servicio realizado?")) return;
    const res = await fetch(`/api/purchases/${purchaseId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error || "No se pudo eliminar el servicio");
      return;
    }
    await loadBalances();
  }

  const fmtDate = (ts: number | null) =>
    ts
      ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "America/Caracas" }).format(new Date(ts * 1000))
      : "—";

  const statusLabel = (status: string) =>
    status === "partial" ? "Abonado" : status === "paid" ? "Pagado" : "Pendiente";

  const statusBadgeClass = (status: string) => {
    if (status === "paid") return "bg-green-100 text-green-700";
    if (status === "partial") return "bg-amber-100 text-amber-700";
    return "bg-red-100 text-red-600";
  };

  const filteredItems = (items: BalanceItem[]) =>
    statusFilter === "all" ? items : items.filter((i) => i.financialStatus === statusFilter);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cuentas por cobrar</h1>
        <p className="text-sm text-gray-500">
          Total adeudado:{" "}
          <span className="font-semibold text-gray-900">${totalUsd.toFixed(2)}</span>
        </p>
      </div>

      <div className="mb-6 flex gap-2">
        {(["balances", "receipts"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? "bg-pink-main text-gray-900" : "bg-gray-100 text-gray-600"
            }`}
          >
            {t === "balances" ? "Cuentas por cobrar" : "Pagos recibidos"}
          </button>
        ))}
      </div>

      {tab === "balances" && (
        <>
          <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1">
            {(["all", "pending", "partial", "paid"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {s === "all" ? "Todas" : s === "pending" ? "Pendientes" : s === "partial" ? "Abonadas" : "Pagadas"}
              </button>
            ))}
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
                      <button
                        onClick={() => setAddingFor(c)}
                        className="rounded-xl bg-pink-100 px-2 py-1 text-xs font-medium text-pink-700 hover:bg-pink-200"
                      >
                        Servicio realizado
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Detalle de servicios
                    </p>
                    {filteredItems(c.items).length === 0 ? (
                      <p className="text-sm text-gray-400">Sin servicios en este estado</p>
                    ) : (
                      <div className="space-y-2">
                        {filteredItems(c.items).map((i) => (
                          <div key={i.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-gray-900">{i.serviceName}</p>
                              <p className="text-xs text-gray-500">{fmtDate(i.startTime ?? i.completionDate)}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className={`rounded-lg px-2 py-1 text-xs font-medium ${statusBadgeClass(i.financialStatus)}`}>
                                {statusLabel(i.financialStatus)}
                              </span>
                              <span className="text-sm font-semibold text-gray-900">${i.price.toFixed(2)}</span>
                              {i.startTime === null && (
                                <button
                                  onClick={() => void deletePurchase(c.clientId, i.id)}
                                  className="rounded-lg bg-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-300"
                                >
                                  Eliminar
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
        </>
      )}

      {tab === "receipts" && (
        <div>
          <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1">
            {(["pending", "approved", "rejected", "all"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setReceiptFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  receiptFilter === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                }`}
              >
                {s === "pending" ? "Pendientes" : s === "approved" ? "Aprobadas" : s === "rejected" ? "Rechazadas" : "Todas"}
              </button>
            ))}
          </div>

          {receipts.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
              <p className="text-gray-400">No hay capturas de pago aquí</p>
            </div>
          ) : (
            <div className="space-y-3">
              {receipts.map((r) => (
                <div key={r.id} className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  {r.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photoUrl} alt="Captura" className="h-16 w-16 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{r.clientName ?? "Cliente"}</p>
                    <p className="text-sm text-gray-500">
                      {r.amountVes.toFixed(2)} Bs ≈ <span className="font-semibold text-gray-900">${r.amountUsd.toFixed(2)}</span> · tasa {r.rate.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400">{fmtDate(r.createdAt)}</p>
                    {r.reviewNotes && <p className="mt-1 text-xs text-red-600">{r.reviewNotes}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {r.status === "pending" ? (
                      <>
                        <button
                          onClick={() => void reviewReceipt(r.id, "approve")}
                          className="rounded-xl bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors"
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() => void reviewReceipt(r.id, "reject")}
                          className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                        >
                          Rechazar
                        </button>
                      </>
                    ) : (
                      <span
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                          r.status === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                        }`}
                      >
                        {r.status === "approved" ? "Aprobada" : "Rechazada"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
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

      {addingFor && (
        <AddServiceDialog
          clientId={addingFor.clientId}
          clientName={addingFor.name}
          onClose={() => setAddingFor(null)}
          onSaved={() => {
            setAddingFor(null);
            void loadBalances();
          }}
        />
      )}
    </div>
  );
}
