"use client";

import { useState, useEffect, useCallback } from "react";
import { todayStr, dateToDayStartTs } from "@/lib/time";
import { SupplierPaymentDialog } from "@/components/SupplierPaymentDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Bill = {
  id: string;
  supplierId: string | null;
  supplierName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  invoiceNumber: string | null;
  type: "inventory" | "fixed";
  billDate: number;
  dueDate: number | null;
  currency: "USD" | "VES";
  amountVes: number | null;
  rate: number | null;
  totalUsd: number;
  status: "pending" | "partial" | "paid";
  notes: string | null;
  paidUsd: number;
};

type Payment = {
  id: string;
  billId: string;
  supplierName: string | null;
  invoiceNumber: string | null;
  bankAccountId: string | null;
  bankName: string | null;
  amountUsd: number;
  currency: "USD" | "VES";
  amountVes: number | null;
  rate: number | null;
  paymentDate: number;
  reference: string;
  notes: string | null;
};

type BankAccount = {
  id: string;
  bankName: string;
  accountType: "savings" | "checking" | "cash";
  accountNumber: string | null;
  currency: "USD" | "VES";
  isActive: number;
  notes: string | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

export function AccountsPayableContent() {
  const [tab, setTab] = useState<"porPagar" | "pagos" | "bancos">("porPagar");
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState<Bill | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<Payment | null>(null);
  const [deletingBank, setDeletingBank] = useState<BankAccount | null>(null);
  const [confirmError, setConfirmError] = useState("");
  const [bankBusy, setBankBusy] = useState(false);

  const [bankForm, setBankForm] = useState<{
    id: string | null;
    bankName: string;
    accountType: "savings" | "checking" | "cash";
    accountNumber: string;
    currency: "USD" | "VES";
    isActive: number;
    notes: string;
  }>({ id: null, bankName: "", accountType: "savings", accountNumber: "", currency: "USD", isActive: 1, notes: "" });

  const loadBills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bills");
      const data = await res.json();
      setBills(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPayments = useCallback(async () => {
    const res = await fetch("/api/supplier-payments");
    const data = await res.json();
    setPayments(Array.isArray(data) ? data : []);
  }, []);

  const loadBanks = useCallback(async () => {
    const res = await fetch("/api/bank-accounts?includeInactive=1");
    const data = await res.json();
    setBanks(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    void loadBills();
    void loadPayments();
    void loadBanks();
  }, [loadBills, loadPayments, loadBanks]);

  const fmtDate = (ts: number | null) =>
    ts
      ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "America/Caracas" }).format(new Date(ts * 1000))
      : "—";

  const dayStart = dateToDayStartTs(todayStr());
  const in7Days = dayStart + 7 * 86400;

  const payableBills = bills
    .filter((b) => b.status !== "paid")
    .sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity));

  async function saveBank() {
    const body = {
      bankName: bankForm.bankName.trim(),
      accountType: bankForm.accountType,
      accountNumber: bankForm.accountNumber.trim(),
      currency: bankForm.currency,
      isActive: bankForm.isActive,
      notes: bankForm.notes.trim(),
    };
    setBankBusy(true);
    try {
      const url = bankForm.id ? `/api/bank-accounts/${bankForm.id}` : "/api/bank-accounts";
      const method = bankForm.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar la cuenta");
      }
      setBankForm({ id: null, bankName: "", accountType: "savings", accountNumber: "", currency: "USD", isActive: 1, notes: "" });
      await loadBanks();
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBankBusy(false);
    }
  }

  async function confirmDeletePayment() {
    if (!deletingPayment) return;
    setBankBusy(true);
    setConfirmError("");
    try {
      const res = await fetch(`/api/supplier-payments/${deletingPayment.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo eliminar el pago");
      }
      setDeletingPayment(null);
      await Promise.all([loadPayments(), loadBills()]);
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBankBusy(false);
    }
  }

  async function confirmDeleteBank() {
    if (!deletingBank) return;
    setBankBusy(true);
    setConfirmError("");
    try {
      const res = await fetch(`/api/bank-accounts/${deletingBank.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo eliminar la cuenta");
      }
      setDeletingBank(null);
      await loadBanks();
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBankBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900">Cuentas por pagar</h1>

      <div className="mt-4 flex gap-2">
        {([
          ["porPagar", "Por pagar"],
          ["pagos", "Pagos realizados"],
          ["bancos", "Bancos"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              tab === key ? "bg-pink-main text-gray-900" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "porPagar" && (
        <div className="mt-6">
          <p className="mb-3 text-sm text-gray-500">
            Total por pagar:{" "}
            <span className="font-semibold text-gray-900">
              ${payableBills.reduce((s, b) => s + round2(Math.max(0, b.totalUsd - b.paidUsd)), 0).toFixed(2)}
            </span>
          </p>
          {loading && bills.length === 0 ? (
            <p className="text-gray-400">Cargando...</p>
          ) : payableBills.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
              <p className="text-gray-400">No hay cuentas por pagar pendientes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payableBills.map((b) => {
                const pending = round2(Math.max(0, b.totalUsd - b.paidUsd));
                const overdue = b.dueDate !== null && b.dueDate < dayStart;
                const dueSoon = b.dueDate !== null && b.dueDate >= dayStart && b.dueDate <= in7Days;
                return (
                  <div key={b.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-gray-900">{b.supplierName ?? "Sin proveedor"}</p>
                          {b.invoiceNumber && (
                            <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{b.invoiceNumber}</span>
                          )}
                          {overdue && (
                            <span className="rounded-lg bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">Vencida</span>
                          )}
                          {dueSoon && (
                            <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Por vencer</span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                          {b.type === "inventory" ? "Inventario" : "Gasto fijo"} · Vence: {fmtDate(b.dueDate)}
                        </p>
                        {b.notes && <p className="mt-1 text-xs text-gray-400">{b.notes}</p>}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <p className="rounded-lg bg-pink-light px-3 py-1.5 text-sm font-bold text-gray-900">${pending.toFixed(2)}</p>
                        <button
                          onClick={() => setPaying(b)}
                          className="rounded-xl bg-pink-main px-3 py-1.5 text-xs font-medium text-gray-900 hover:bg-pink-light transition-colors"
                        >
                          Registrar pago
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "pagos" && (
        <div className="mt-6">
          {payments.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
              <p className="text-gray-400">No hay pagos registrados</p>
            </div>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {p.supplierName ?? "Sin proveedor"} {p.invoiceNumber && `· ${p.invoiceNumber}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      ${p.amountUsd.toFixed(2)} {p.currency === "VES" && `· ${p.amountVes?.toFixed(2)} Bs`} ·{" "}
                      {p.bankName ?? "Sin banco"} · {fmtDate(p.paymentDate)} · Ref: {p.reference}
                    </p>
                    {p.notes && <p className="text-xs text-gray-400">{p.notes}</p>}
                  </div>
                  <button
                    onClick={() => setDeletingPayment(p)}
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

      {tab === "bancos" && (
        <div className="mt-6">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-gray-900">
              {bankForm.id ? "Editar cuenta" : "Nueva cuenta"}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={bankForm.bankName}
                onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                placeholder="Banco (ej: Banesco)"
                className={inputCls}
              />
              <div className="flex gap-2">
                <select
                  value={bankForm.accountType}
                  onChange={(e) => setBankForm({ ...bankForm, accountType: e.target.value as BankAccount["accountType"] })}
                  className={inputCls}
                >
                  <option value="savings">Ahorro</option>
                  <option value="checking">Corriente</option>
                  <option value="cash">Efectivo</option>
                </select>
                <select
                  value={bankForm.currency}
                  onChange={(e) => setBankForm({ ...bankForm, currency: e.target.value as "USD" | "VES" })}
                  className={inputCls}
                >
                  <option value="USD">$</option>
                  <option value="VES">Bs</option>
                </select>
              </div>
              <input
                value={bankForm.accountNumber}
                onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                placeholder="Nº de cuenta"
                className={inputCls}
              />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={bankForm.isActive === 1}
                    onChange={(e) => setBankForm({ ...bankForm, isActive: e.target.checked ? 1 : 0 })}
                    className="h-4 w-4"
                  />
                  Activa
                </label>
              </div>
              <input
                value={bankForm.notes}
                onChange={(e) => setBankForm({ ...bankForm, notes: e.target.value })}
                placeholder="Notas (opcional)"
                className={`${inputCls} sm:col-span-2`}
              />
            </div>
            {confirmError && !deletingPayment && !deletingBank && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{confirmError}</p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => void saveBank()}
                disabled={bankBusy || !bankForm.bankName.trim()}
                className="rounded-xl bg-pink-main px-4 py-2 text-sm font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50 transition-colors"
              >
                {bankBusy ? "Guardando..." : bankForm.id ? "Guardar cambios" : "Añadir cuenta"}
              </button>
              {bankForm.id && (
                <button
                  onClick={() => setBankForm({ id: null, bankName: "", accountType: "savings", accountNumber: "", currency: "USD", isActive: 1, notes: "" })}
                  className="rounded-xl bg-gray-100 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Cancelar edición
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {banks.length === 0 ? (
              <p className="text-sm text-gray-400">Sin cuentas bancarias registradas</p>
            ) : (
              banks.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {b.bankName} · {b.currency}
                      {b.isActive === 0 && <span className="ml-2 rounded-lg bg-gray-100 px-2 py-0.5 text-xs text-gray-400">Inactiva</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      {b.accountType} {b.accountNumber && `· ${b.accountNumber}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setBankForm({ id: b.id, bankName: b.bankName, accountType: b.accountType, accountNumber: b.accountNumber ?? "", currency: b.currency, isActive: b.isActive, notes: b.notes ?? "" })}
                      className="rounded-lg bg-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-300"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setDeletingBank(b)}
                      className="rounded-lg bg-red-100 px-2 py-1 text-xs text-red-600 hover:bg-red-200"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {paying && (
        <SupplierPaymentDialog
          bill={paying}
          onClose={() => setPaying(null)}
          onSaved={() => {
            setPaying(null);
            void Promise.all([loadBills(), loadPayments()]);
          }}
        />
      )}

      {deletingPayment && (
        <ConfirmDialog
          title="Eliminar pago"
          message={`¿Eliminar el pago de $${deletingPayment.amountUsd.toFixed(2)} a ${deletingPayment.supplierName ?? "proveedor"}?`}
          confirmLabel="Eliminar"
          danger
          busy={bankBusy}
          error={confirmError}
          onConfirm={() => void confirmDeletePayment()}
          onClose={() => {
            setDeletingPayment(null);
            setConfirmError("");
          }}
        />
      )}

      {deletingBank && (
        <ConfirmDialog
          title="Eliminar cuenta"
          message={`¿Eliminar la cuenta de ${deletingBank.bankName}?`}
          confirmLabel="Eliminar"
          danger
          busy={bankBusy}
          error={confirmError}
          onConfirm={() => void confirmDeleteBank()}
          onClose={() => {
            setDeletingBank(null);
            setConfirmError("");
          }}
        />
      )}
    </div>
  );
}
