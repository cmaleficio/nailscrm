"use client";

import { useState, useEffect } from "react";
import { todayStr, dateTimeToTs } from "@/lib/time";
import { newId } from "@/lib/id";

type ItemLine = {
  key: string;
  inventoryItemId: string;
  description: string;
  quantity: string;
  unitCostUsd: string;
};

type BillPayload = {
  id: string;
  type: "inventory" | "fixed";
  supplierId: string | null;
  categoryId: string | null;
  invoiceNumber: string | null;
  billDate: number;
  dueDate: number | null;
  currency: "USD" | "VES";
  amountVes: number | null;
  rate: number | null;
  totalUsd: number;
  notes: string | null;
  paidUsd: number;
  items: { id: string; inventoryItemId: string | null; inventoryItemName?: string | null; description: string | null; quantity: number; unitCostUsd: number; totalUsd: number }[];
};

type Props = {
  bill: BillPayload | null;
  onClose: () => void;
  onSaved: () => void;
};

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

function fmtDateInput(ts: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ts * 1000));
}

export function BillFormDialog({ bill, onClose, onSaved }: Props) {
  const isEdit = Boolean(bill);
  const hasPayments = (bill?.paidUsd ?? 0) > 0;

  const [type, setType] = useState<"inventory" | "fixed">(bill?.type ?? "inventory");
  const [supplierId, setSupplierId] = useState(bill?.supplierId ?? "");
  const [categoryId, setCategoryId] = useState(bill?.categoryId ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState(bill?.invoiceNumber ?? "");
  const [billDate, setBillDate] = useState(bill ? fmtDateInput(bill.billDate) : todayStr());
  const [dueDate, setDueDate] = useState(bill?.dueDate ? fmtDateInput(bill.dueDate) : "");
  const [currency, setCurrency] = useState<"USD" | "VES">(bill?.currency ?? "USD");
  const [amountUsd, setAmountUsd] = useState(bill && bill.currency === "USD" && bill.type === "fixed" ? String(bill.totalUsd) : "");
  const [amountVes, setAmountVes] = useState(bill?.amountVes ? String(bill.amountVes) : "");
  const [rate, setRate] = useState<{ rate: number | null; source: string | null }>({ rate: null, source: null });
  const [manualRate, setManualRate] = useState(bill?.rate ? String(bill.rate) : "");
  const [notes, setNotes] = useState(bill?.notes ?? "");
  const [lines, setLines] = useState<ItemLine[]>(
    bill?.items?.length
      ? bill.items.map((it) => ({
          key: newId(),
          inventoryItemId: it.inventoryItemId ?? "",
          description: it.description ?? "",
          quantity: String(it.quantity),
          unitCostUsd: String(it.unitCostUsd),
        }))
      : []
  );
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [inventoryItems, setInventoryItems] = useState<{ id: string; name: string; unit: string }[]>([]);
  const [newSupplier, setNewSupplier] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("unidad");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/suppliers").then((r) => r.json()),
      fetch("/api/expense-categories").then((r) => r.json()),
      fetch("/api/inventory/items").then((r) => r.json()),
    ]).then(([s, c, inv]) => {
      setSuppliers(Array.isArray(s) ? s : []);
      setCategories(Array.isArray(c) ? c : []);
      setInventoryItems(Array.isArray(inv) ? inv : []);
    });
    fetch("/api/exchange-rate")
      .then((r) => r.json())
      .then((data) => setRate(data))
      .catch(() => {});
  }, []);

  async function addSupplier() {
    const name = newSupplier.trim();
    if (!name) return;
    const res = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const created = await res.json();
      setSuppliers((prev) => [...prev, created]);
      setSupplierId(created.id);
      setNewSupplier("");
    }
  }

  async function addItem() {
    const name = newItemName.trim();
    if (!name) return;
    const res = await fetch("/api/inventory/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, unit: newItemUnit }),
    });
    if (res.ok) {
      const created = await res.json();
      setInventoryItems((prev) => [...prev, created]);
      setLines((prev) => [
        ...prev,
        { key: newId(), inventoryItemId: created.id, description: "", quantity: "1", unitCostUsd: "" },
      ]);
      setNewItemName("");
      setNewItemUnit("unidad");
      setError("");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudo crear el producto");
    }
  }

  const lineTotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCostUsd) || 0), 0);

  function updateLine(key: string, patch: Partial<ItemLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function submit() {
    if (!billDate) {
      setError("La fecha de la factura es requerida");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const effectiveRate = currency === "VES" ? parseFloat(manualRate || String(rate.rate || "")) : null;
      if (currency === "VES" && (!effectiveRate || effectiveRate <= 0)) {
        throw new Error("Escribe la tasa del día");
      }
      const body: Record<string, unknown> = {
        supplierId: supplierId || null,
        categoryId: categoryId || null,
        invoiceNumber: invoiceNumber.trim(),
        billDate: dateTimeToTs(billDate, "00:00"),
        dueDate: dueDate ? dateTimeToTs(dueDate, "00:00") : null,
        notes: notes.trim(),
      };
      if (type === "inventory") {
        if (lines.length === 0) throw new Error("Añade al menos un producto");
        body.type = "inventory";
        body.currency = "USD";
        body.items = lines.map((l) => ({
          inventoryItemId: l.inventoryItemId || null,
          description: l.description.trim(),
          quantity: Number(l.quantity) || 0,
          unitCostUsd: Number(l.unitCostUsd) || 0,
        }));
      } else {
        body.type = "fixed";
        body.currency = currency;
        if (currency === "VES") {
          body.amountVes = parseFloat(amountVes) || 0;
          body.rate = effectiveRate;
        } else {
          body.totalUsd = parseFloat(amountUsd) || 0;
        }
      }
      const url = isEdit ? `/api/bills/${bill!.id}` : "/api/bills";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar la factura");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={saving ? undefined : onClose} />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">
          {isEdit ? "Editar factura" : "Nueva factura"}
        </h3>
        {hasPayments && (
          <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Esta factura tiene pagos: solo puedes editar proveedor, categoría, número, fechas y notas.
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setType("inventory")}
            disabled={hasPayments}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              type === "inventory" ? "bg-pink-main text-gray-900" : "bg-gray-100 text-gray-600"
            }`}
          >
            Inventario
          </button>
          <button
            onClick={() => setType("fixed")}
            disabled={hasPayments}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              type === "fixed" ? "bg-pink-main text-gray-900" : "bg-gray-100 text-gray-600"
            }`}
          >
            Gasto fijo
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Proveedor</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>
              <option value="">— Sin proveedor —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <div className="mt-2 flex gap-2">
              <input
                value={newSupplier}
                onChange={(e) => setNewSupplier(e.target.value)}
                placeholder="Nuevo proveedor..."
                className={inputCls}
              />
              <button
                onClick={addSupplier}
                disabled={!newSupplier.trim()}
                className="shrink-0 rounded-xl bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                + Nuevo
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Categoría</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
              <option value="">— Sin categoría —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Nº factura</label>
            <input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Ej: F-1001"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Fecha</label>
              <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Vence</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>

        {type === "fixed" && (
          <div className="mt-4 flex gap-2">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as "USD" | "VES")}
              disabled={hasPayments}
              className={inputCls}
            >
              <option value="USD">$</option>
              <option value="VES">Bs</option>
            </select>
            {currency === "USD" ? (
              <input
                type="number"
                min="0"
                step="0.01"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                placeholder="Total en $"
                className={inputCls}
              />
            ) : (
              <>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountVes}
                  onChange={(e) => setAmountVes(e.target.value)}
                  placeholder="Total en Bs"
                  className={inputCls}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualRate || (rate.rate ? String(rate.rate) : "")}
                  onChange={(e) => setManualRate(e.target.value)}
                  placeholder="Tasa Bs/US$"
                  className={inputCls}
                />
              </>
            )}
          </div>
        )}

        {type === "inventory" && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Productos</p>
              <div className="flex gap-2">
                <input
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Nuevo producto..."
                  className="w-40 rounded-xl border border-gray-200 px-3 py-1.5 text-xs"
                />
                <input
                  value={newItemUnit}
                  onChange={(e) => setNewItemUnit(e.target.value)}
                  className="w-24 rounded-xl border border-gray-200 px-3 py-1.5 text-xs"
                />
                <button
                  onClick={addItem}
                  disabled={!newItemName.trim()}
                  className="rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  + Producto
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {lines.map((l) => (
                <div key={l.key} className="flex items-center gap-2">
                  <select
                    value={l.inventoryItemId}
                    onChange={(e) => updateLine(l.key, { inventoryItemId: e.target.value })}
                    className="min-w-0 flex-1 rounded-xl border border-gray-200 px-2 py-1.5 text-sm"
                  >
                    <option value="">— Sin producto —</option>
                    {inventoryItems.map((it) => (
                      <option key={it.id} value={it.id}>{it.name} ({it.unit})</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={l.quantity}
                    onChange={(e) => updateLine(l.key, { quantity: e.target.value })}
                    placeholder="Cant."
                    className="w-20 rounded-xl border border-gray-200 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={l.unitCostUsd}
                    onChange={(e) => updateLine(l.key, { unitCostUsd: e.target.value })}
                    placeholder="$/un"
                    className="w-24 rounded-xl border border-gray-200 px-2 py-1.5 text-sm"
                  />
                  <button
                    onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                    className="rounded-lg bg-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-300"
                  >
                    ×
                  </button>
                </div>
              ))}
              {lines.length === 0 && (
                <p className="text-sm text-gray-400">Sin productos. Añade líneas con el botón de abajo.</p>
              )}
              <button
                onClick={() =>
                  setLines((prev) => [
                    ...prev,
                    { key: newId(), inventoryItemId: "", description: "", quantity: "1", unitCostUsd: "" },
                  ])
                }
                className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                + Añadir línea
              </button>
            </div>
            <p className="mt-3 text-right text-sm font-semibold text-gray-900">
              Total: ${lineTotal.toFixed(2)}
            </p>
          </div>
        )}

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">Notas (opcional)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
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
            className="flex-1 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Guardar factura"}
          </button>
        </div>
      </div>
    </div>
  );
}
