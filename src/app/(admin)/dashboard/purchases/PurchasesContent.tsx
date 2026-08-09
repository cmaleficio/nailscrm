"use client";

import { useState, useEffect, useCallback } from "react";
import { BillFormDialog } from "@/components/BillFormDialog";
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
  items: {
    id: string;
    inventoryItemId: string | null;
    description: string | null;
    quantity: number;
    unitCostUsd: number;
    totalUsd: number;
  }[];
};

type Supplier = { id: string; name: string; phone: string | null; email: string | null };
type Category = { id: string; name: string; isActive: number };

const statusPill: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  partial: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
};

const typePill: Record<string, string> = {
  inventory: "bg-pink-light text-gray-900",
  fixed: "bg-gray-100 text-gray-600",
};

const fmtDate = (ts: number | null) =>
  ts
    ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "America/Caracas" }).format(new Date(ts * 1000))
    : "—";

export function PurchasesContent() {
  const [activeTab, setActiveTab] = useState<"facturas" | "proveedores" | "categorias">("facturas");
  const [bills, setBills] = useState<Bill[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "partial" | "paid">("all");
  const [monthFilter, setMonthFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [deleting, setDeleting] = useState<{ kind: "bill" | "supplier" | "category"; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadBills = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (monthFilter) params.set("month", monthFilter);
    const res = await fetch(`/api/bills?${params.toString()}`);
    if (res.ok) {
      setBills(await res.json());
    }
  }, [statusFilter, monthFilter]);

  const loadSuppliers = useCallback(async () => {
    const res = await fetch("/api/suppliers");
    if (res.ok) setSuppliers(await res.json());
  }, []);

  const loadCategories = useCallback(async () => {
    const res = await fetch("/api/expense-categories?includeInactive=1");
    if (res.ok) setCategories(await res.json());
  }, []);

  useEffect(() => {
    if (activeTab === "facturas") void loadBills();
    if (activeTab === "proveedores") void loadSuppliers();
    if (activeTab === "categorias") void loadCategories();
  }, [activeTab, loadBills, loadSuppliers, loadCategories]);

  async function openEdit(billId: string) {
    const res = await fetch(`/api/bills/${billId}`);
    if (res.ok) {
      const data = await res.json();
      setEditingBill({
        ...data,
        supplierId: data.supplierId ?? null,
        categoryId: data.categoryId ?? null,
        supplierName: data.supplierName ?? null,
        categoryName: data.categoryName ?? null,
        invoiceNumber: data.invoiceNumber ?? null,
        amountVes: data.amountVes ?? null,
        rate: data.rate ?? null,
        notes: data.notes ?? null,
        dueDate: data.dueDate ?? null,
        items: data.items ?? [],
      });
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setError("");
    try {
      const url =
        deleting.kind === "bill"
          ? `/api/bills/${deleting.id}`
          : deleting.kind === "supplier"
            ? `/api/suppliers/${deleting.id}`
            : `/api/expense-categories/${deleting.id}`;
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo eliminar");
        return;
      }
      setSuccess("Eliminado correctamente");
      if (deleting.kind === "bill") await loadBills();
      if (deleting.kind === "supplier") await loadSuppliers();
      if (deleting.kind === "category") await loadCategories();
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compras</h1>
          <p className="text-sm text-gray-500">Facturas, proveedores y categorías de gasto</p>
        </div>
        <button
          onClick={() => {
            setEditingBill(null);
            setShowForm(true);
          }}
          className="rounded-xl bg-pink-main px-4 py-2 text-sm font-medium text-gray-900 hover:bg-pink-light transition-colors"
        >
          + Nueva factura
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {success && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>
      )}

      <div className="mb-6 flex gap-2">
        {(["facturas", "proveedores", "categorias"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab ? "bg-pink-main text-gray-900" : "bg-gray-100 text-gray-600"
            }`}
          >
            {tab === "facturas" ? "Facturas" : tab === "proveedores" ? "Proveedores" : "Categorías"}
          </button>
        ))}
      </div>

      {activeTab === "facturas" && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
              {(["all", "pending", "partial", "paid"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                  }`}
                >
                  {s === "all" ? "Todas" : s === "pending" ? "Pendientes" : s === "partial" ? "Parciales" : "Pagadas"}
                </button>
              ))}
            </div>
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className={inputCls}
              style={{ width: "auto" }}
            />
          </div>

          <div className="space-y-3">
            {bills.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
                <p className="text-gray-400">No hay facturas con estos filtros</p>
              </div>
            ) : (
              bills.map((b) => (
                <div key={b.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-gray-900">{b.supplierName ?? "Sin proveedor"}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${typePill[b.type]}`}>
                          {b.type === "inventory" ? "Inventario" : "Gasto fijo"}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${statusPill[b.status]}`}>
                          {b.status === "pending" ? "Pendiente" : b.status === "partial" ? "Parcial" : "Pagada"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        {b.invoiceNumber ? `${b.invoiceNumber} · ` : ""}
                        {fmtDate(b.billDate)}
                        {b.categoryName ? ` · ${b.categoryName}` : ""}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        ${b.totalUsd.toFixed(2)}
                        {b.paidUsd > 0 && (
                          <span className="ml-2 text-xs font-normal text-gray-500">
                            Pagado ${b.paidUsd.toFixed(2)} / Pendiente ${(b.totalUsd - b.paidUsd).toFixed(2)}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => void openEdit(b.id)}
                        className="rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setDeleting({ kind: "bill", id: b.id })}
                        disabled={b.paidUsd > 0}
                        className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-40"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {activeTab === "proveedores" && (
        <SuppliersSection suppliers={suppliers} onReload={loadSuppliers} onDelete={(id) => setDeleting({ kind: "supplier", id })} />
      )}

      {activeTab === "categorias" && (
        <CategoriesSection categories={categories} onReload={loadCategories} onDelete={(id) => setDeleting({ kind: "category", id })} />
      )}

      {showForm && (
        <BillFormDialog
          bill={editingBill}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            setSuccess("Factura guardada correctamente");
            void loadBills();
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Confirmar eliminación"
          message="¿Seguro que quieres eliminar este registro? Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          danger
          busy={busy}
          error={error}
          onConfirm={() => void confirmDelete()}
          onClose={() => {
            setDeleting(null);
            setError("");
          }}
        />
      )}
    </div>
  );
}

function SuppliersSection({
  suppliers,
  onReload,
  onDelete,
}: {
  suppliers: Supplier[];
  onReload: () => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), email: email.trim() }),
      });
      if (res.ok) {
        setName("");
        setPhone("");
        setEmail("");
        await onReload();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Teléfono"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none"
          />
        </div>
        <button
          onClick={() => void create()}
          disabled={busy || !name.trim()}
          className="mt-3 rounded-xl bg-pink-main px-4 py-2 text-sm font-medium text-gray-900 hover:bg-pink-light transition-colors disabled:opacity-50"
        >
          {busy ? "Guardando..." : "+ Nuevo proveedor"}
        </button>
      </div>

      {suppliers.map((s) => (
        <div key={s.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="min-w-0">
            <p className="font-medium text-gray-900">{s.name}</p>
            <p className="text-sm text-gray-500">{s.phone ?? "Sin teléfono"} · {s.email ?? "Sin email"}</p>
          </div>
          <button
            onClick={() => onDelete(s.id)}
            className="shrink-0 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
          >
            Eliminar
          </button>
        </div>
      ))}
    </div>
  );
}

function CategoriesSection({
  categories,
  onReload,
  onDelete,
}: {
  categories: Category[];
  onReload: () => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/expense-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        setName("");
        await onReload();
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggle(cat: Category) {
    await fetch(`/api/expense-categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: cat.isActive ? 0 : 1 }),
    });
    await onReload();
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la categoría"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none"
          />
          <button
            onClick={() => void create()}
            disabled={busy || !name.trim()}
            className="shrink-0 rounded-xl bg-pink-main px-4 py-2 text-sm font-medium text-gray-900 hover:bg-pink-light transition-colors disabled:opacity-50"
          >
            {busy ? "Guardando..." : "+ Añadir"}
          </button>
        </div>
      </div>

      {categories.map((c) => (
        <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div>
            <p className={`font-medium ${c.isActive ? "text-gray-900" : "text-gray-400 line-through"}`}>{c.name}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => void toggle(c)}
              className="rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors"
            >
              {c.isActive ? "Desactivar" : "Activar"}
            </button>
            <button
              onClick={() => onDelete(c.id)}
              className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
            >
              Eliminar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
