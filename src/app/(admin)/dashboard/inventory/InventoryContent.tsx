"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import { MovementDialog } from "@/components/MovementDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type InventoryItem = {
  id: string;
  code?: string;
  name: string;
  unit: string;
  stock: number;
  avgCost: number;
  minStock: number;
  isActive: number;
  notes: string | null;
  barcode: string | null;
  photoUrl: string | null;
  stockValue: number;
  estUsos: number | null;
};

type Movement = {
  id: string;
  inventoryItemId: string;
  kind: "in" | "out" | "adjust";
  quantity: number;
  unitCostUsd: number | null;
  refType: "bill" | "manual";
  refId: string | null;
  notes: string | null;
  createdAt: number;
};

type Service = { id: string; name: string; isActive: number };

type UseLine = { key: string; inventoryItemId: string; quantityPerService: string };

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

export function InventoryContent({ canAdjust = false }: { canAdjust?: boolean }) {
  const [tab, setTab] = useState<"items" | "movimientos" | "servicios">("items");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [uses, setUses] = useState<Record<string, UseLine[]>>({});
  const [loading, setLoading] = useState(false);

  const [selectedItemId, setSelectedItemId] = useState("");
  const [movements, setMovements] = useState<Movement[]>([]);
  const [movementItem, setMovementItem] = useState<InventoryItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);
  const [confirmError, setConfirmError] = useState("");
  const [busy, setBusy] = useState(false);

  const [newItemForm, setNewItemForm] = useState({ code: "", name: "", unit: "unidad", minStock: "0", barcode: "", photoUrl: "" });
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", unit: "", minStock: "0", isActive: 1 });
  const [savingUses, setSavingUses] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inventory/items?includeInactive=1");
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
    Promise.all([
      fetch("/api/services?includeInactive=1").then((r) => r.json()),
      fetch("/api/service-products").then((r) => r.json()),
    ]).then(([svcs, sps]) => {
      setServices(Array.isArray(svcs) ? svcs : []);
      const products = Array.isArray(sps) ? sps : [];
      const map: Record<string, UseLine[]> = {};
      for (const p of products) {
        if (!map[p.serviceId]) map[p.serviceId] = [];
        map[p.serviceId].push({
          key: crypto.randomUUID(),
          inventoryItemId: p.inventoryItemId,
          quantityPerService: String(p.quantityPerService),
        });
      }
      setUses(map);
    });
  }, [loadItems]);

  useEffect(() => {
    if (!selectedItemId) {
      setMovements([]);
      return;
    }
    fetch(`/api/inventory/items/${selectedItemId}/movements`)
      .then((r) => r.json())
      .then((data) => setMovements(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [selectedItemId]);

  const fmtDate = (ts: number) =>
    new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "America/Caracas" }).format(new Date(ts * 1000));

  async function handleUpload(file: File) {
    setUploading(true);
    setConfirmError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error("No se pudo subir la foto");
      const data = await res.json();
      setNewItemForm((f) => ({ ...f, photoUrl: data.url }));
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Error subiendo foto");
    } finally {
      setUploading(false);
    }
  }

  async function createItem() {
    const name = newItemForm.name.trim();
    if (!name) return;
    setBusy(true);
    setConfirmError("");
    try {
      const res = await fetch("/api/inventory/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newItemForm.code.trim(),
          name,
          unit: newItemForm.unit.trim(),
          minStock: Number(newItemForm.minStock) || 0,
          barcode: newItemForm.barcode.trim(),
          photoUrl: newItemForm.photoUrl,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo crear el producto");
      }
      setNewItemForm({ code: "", name: "", unit: "unidad", minStock: "0", barcode: "", photoUrl: "" });
      await loadItems();
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(item: InventoryItem) {
    setBusy(true);
    setConfirmError("");
    try {
      const res = await fetch(`/api/inventory/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          unit: editForm.unit.trim(),
          minStock: Number(editForm.minStock) || 0,
          isActive: editForm.isActive === 1,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar el producto");
      }
      setEditingId(null);
      await loadItems();
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeleteItem() {
    if (!deletingItem) return;
    setBusy(true);
    setConfirmError("");
    try {
      const res = await fetch(`/api/inventory/items/${deletingItem.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo eliminar el producto");
      }
      setDeletingItem(null);
      await loadItems();
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  }

  function addUseLine(serviceId: string) {
    setUses((prev) => ({
      ...prev,
      [serviceId]: [...(prev[serviceId] ?? []), { key: crypto.randomUUID(), inventoryItemId: "", quantityPerService: "1" }],
    }));
  }

  function updateUseLine(serviceId: string, key: string, patch: Partial<UseLine>) {
    setUses((prev) => ({
      ...prev,
      [serviceId]: (prev[serviceId] ?? []).map((u) => (u.key === key ? { ...u, ...patch } : u)),
    }));
  }

  function removeUseLine(serviceId: string, key: string) {
    setUses((prev) => ({
      ...prev,
      [serviceId]: (prev[serviceId] ?? []).filter((u) => u.key !== key),
    }));
  }

  async function saveServiceUses(serviceId: string) {
    setSavingUses(serviceId);
    setConfirmError("");
    try {
      const items = (uses[serviceId] ?? [])
        .filter((u) => u.inventoryItemId && Number(u.quantityPerService) > 0)
        .map((u) => ({ inventoryItemId: u.inventoryItemId, quantityPerService: Number(u.quantityPerService) }));
      const res = await fetch("/api/service-products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, items }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar");
      }
      await loadItems();
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSavingUses(null);
    }
  }

  const kindPill = (kind: Movement["kind"]) => {
    const cls =
      kind === "in"
        ? "bg-green-100 text-green-700"
        : kind === "out"
          ? "bg-red-100 text-red-600"
          : "bg-amber-100 text-amber-700";
    const label = kind === "in" ? "Entrada" : kind === "out" ? "Salida" : "Ajuste";
    return (
      <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
    );
  };

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>

      <div className="mt-4 flex gap-2">
        {([
          ["items", "Productos"],
          ["movimientos", "Movimientos"],
          ["servicios", "Uso por servicio"],
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

      {tab === "items" && (
        <div className="mt-6">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-gray-900">Nuevo producto</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={newItemForm.code}
                onChange={(e) => setNewItemForm({ ...newItemForm, code: e.target.value })}
                placeholder="Código de producto * (ej: ACR-001)"
                className={inputCls}
              />
              <input
                value={newItemForm.name}
                onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
                placeholder="Nombre *"
                className={inputCls}
              />
              <input
                value={newItemForm.barcode}
                onChange={(e) => setNewItemForm({ ...newItemForm, barcode: e.target.value })}
                placeholder="Código de barras (opcional)"
                className={inputCls}
              />
              <div className="flex gap-2">
                <input
                  value={newItemForm.unit}
                  onChange={(e) => setNewItemForm({ ...newItemForm, unit: e.target.value })}
                  placeholder="Unidad"
                  className={inputCls}
                />
                <input
                  type="number"
                  min="0"
                  value={newItemForm.minStock}
                  onChange={(e) => setNewItemForm({ ...newItemForm, minStock: e.target.value })}
                  placeholder="Stock mín."
                  className="w-28 rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(f);
                }}
                className={inputCls}
              />
              {newItemForm.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={newItemForm.photoUrl} alt="Foto" className="h-16 w-16 rounded-lg object-cover" />
              )}
            </div>
            <button
              onClick={() => void createItem()}
              disabled={busy || uploading || !newItemForm.code.trim() || !newItemForm.name.trim()}
              className="mt-3 shrink-0 rounded-xl bg-pink-main px-4 py-2 text-sm font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50 transition-colors"
            >
              + Producto
            </button>
          </div>

          {confirmError && !deletingItem && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{confirmError}</p>
          )}

          {loading && items.length === 0 ? (
            <p className="mt-6 text-gray-400">Cargando...</p>
          ) : items.length === 0 ? (
            <div className="mt-6 rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
              <p className="text-gray-400">Sin productos en inventario</p>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                    <th className="px-3 py-3">Foto</th>
                    <th className="px-3 py-3">Código</th>
                    <th className="px-3 py-3">Nombre</th>
                    <th className="px-3 py-3">Cód. barras</th>
                    <th className="px-3 py-3">Unidad</th>
                    <th className="px-3 py-3">Stock</th>
                    <th className="px-3 py-3">Stock mín</th>
                    <th className="px-3 py-3">Costo avg</th>
                    <th className="px-3 py-3">Valor</th>
                    <th className="px-3 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const lowStock = item.stock <= item.minStock && item.minStock > 0;
                    return (
                      <Fragment key={item.id}>
                        <tr className={`border-b border-gray-50 ${item.isActive === 0 ? "opacity-50" : ""}`}>
                        <td className="px-3 py-2">
                          {item.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.photoUrl} alt={item.name} className="h-10 w-10 rounded-lg object-cover" />
                          ) : (
                            <span className="block h-10 w-10 rounded-lg bg-gray-100" />
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-600">{item.id}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-gray-900">{item.name}</p>
                          {item.isActive === 0 && <span className="text-xs text-gray-400">Inactivo</span>}
                          {lowStock && <span className="ml-1 rounded-lg bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">Stock bajo</span>}
                          {item.estUsos !== null && <span className="ml-1 text-xs text-gray-400">≈ {item.estUsos} usos</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">{item.barcode ?? "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{item.unit}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">{item.stock}</td>
                        <td className="px-3 py-2 text-gray-500">{item.minStock}</td>
                        <td className="px-3 py-2 text-gray-600">${item.avgCost.toFixed(2)}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">${item.stockValue.toFixed(2)}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1.5">
                            <button onClick={() => setMovementItem(item)} className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200">
                              Salida
                            </button>
                            {canAdjust && (
                              <button onClick={() => setMovementItem(item)} className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200">
                                Ajuste
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditingId(item.id);
                                setEditForm({ name: item.name, unit: item.unit, minStock: String(item.minStock), isActive: item.isActive });
                              }}
                              className="rounded-lg bg-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-300"
                            >
                              Editar
                            </button>
                            <button onClick={() => setDeletingItem(item)} className="rounded-lg bg-red-100 px-2 py-1 text-xs text-red-600 hover:bg-red-200">
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                      {editingId === item.id && (
                        <tr className="border-b border-gray-50 bg-gray-50/50">
                          <td colSpan={10} className="px-3 py-3">
                            <div className="flex flex-wrap items-end gap-2">
                              <div className="min-w-0 flex-1">
                                <label className="mb-1 block text-xs font-medium text-gray-600">Nombre</label>
                                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={inputCls} />
                              </div>
                              <div className="w-24">
                                <label className="mb-1 block text-xs font-medium text-gray-600">Unidad</label>
                                <input value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })} className={inputCls} />
                              </div>
                              <div className="w-24">
                                <label className="mb-1 block text-xs font-medium text-gray-600">Stock mín.</label>
                                <input type="number" min="0" value={editForm.minStock} onChange={(e) => setEditForm({ ...editForm, minStock: e.target.value })} className={inputCls} />
                              </div>
                              <label className="flex items-center gap-2 pb-2 text-sm text-gray-600">
                                <input type="checkbox" checked={editForm.isActive === 1} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked ? 1 : 0 })} className="h-4 w-4" />
                                Activo
                              </label>
                              <div className="flex gap-2">
                                <button onClick={() => void saveEdit(item)} disabled={busy} className="rounded-xl bg-pink-main px-3 py-2 text-xs font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50 transition-colors">
                                  Guardar
                                </button>
                                <button onClick={() => setEditingId(null)} disabled={busy} className="rounded-xl bg-gray-100 px-3 py-2 text-xs text-gray-600 hover:bg-gray-200 transition-colors">
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "movimientos" && (
        <div className="mt-6">
          <select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} className={`${inputCls} mb-4`}>
            <option value="">— Selecciona un producto —</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.unit})
              </option>
            ))}
          </select>
          {selectedItemId ? (
            movements.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
                <p className="text-gray-400">Sin movimientos para este producto</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Cantidad</th>
                      <th className="px-4 py-3">Costo un.</th>
                      <th className="px-4 py-3">Ref</th>
                      <th className="px-4 py-3">Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id} className="border-b border-gray-50">
                        <td className="px-4 py-3 text-gray-600">{fmtDate(m.createdAt)}</td>
                        <td className="px-4 py-3">{kindPill(m.kind)}</td>
                        <td className={`px-4 py-3 font-medium ${m.quantity < 0 ? "text-red-600" : "text-green-600"}`}>
                          {m.quantity > 0 ? "+" : ""}{m.quantity}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{m.unitCostUsd !== null ? `$${m.unitCostUsd.toFixed(2)}` : "—"}</td>
                        <td className="px-4 py-3 text-gray-600">{m.refType === "bill" ? "Factura" : "Manual"}</td>
                        <td className="px-4 py-3 text-gray-500">{m.notes ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <p className="text-sm text-gray-400">Elige un producto para ver su kardex</p>
          )}
        </div>
      )}

      {tab === "servicios" && (
        <div className="mt-6 space-y-4">
          {confirmError && !deletingItem && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{confirmError}</p>
          )}
          {services.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
              <p className="text-gray-400">Sin servicios registrados</p>
            </div>
          ) : (
            services.map((s) => (
              <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900">{s.name}</p>
                  <button
                    onClick={() => void saveServiceUses(s.id)}
                    disabled={savingUses === s.id}
                    className="rounded-xl bg-pink-main px-4 py-1.5 text-xs font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50 transition-colors"
                  >
                    {savingUses === s.id ? "Guardando..." : "Guardar"}
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {(uses[s.id] ?? []).map((u) => (
                    <div key={u.key} className="flex items-center gap-2">
                      <select
                        value={u.inventoryItemId}
                        onChange={(e) => updateUseLine(s.id, u.key, { inventoryItemId: e.target.value })}
                        className="min-w-0 flex-1 rounded-xl border border-gray-200 px-2 py-1.5 text-sm"
                      >
                        <option value="">— Sin producto —</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} ({it.unit})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={u.quantityPerService}
                        onChange={(e) => updateUseLine(s.id, u.key, { quantityPerService: e.target.value })}
                        placeholder="Cant."
                        className="w-24 rounded-xl border border-gray-200 px-2 py-1.5 text-sm"
                      />
                      <button
                        onClick={() => removeUseLine(s.id, u.key)}
                        className="rounded-lg bg-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-300"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {(uses[s.id] ?? []).length === 0 && (
                    <p className="text-sm text-gray-400">Sin productos asignados a este servicio</p>
                  )}
                  <button
                    onClick={() => addUseLine(s.id)}
                    className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    + Añadir producto
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {movementItem && (
        <MovementDialog
          item={{ id: movementItem.id, name: movementItem.name, stock: movementItem.stock, unit: movementItem.unit }}
          onClose={() => setMovementItem(null)}
          onSaved={() => {
            setMovementItem(null);
            void loadItems();
          }}
        />
      )}

      {deletingItem && (
        <ConfirmDialog
          title="Eliminar producto"
          message={`¿Eliminar ${deletingItem.name} del inventario?`}
          confirmLabel="Eliminar"
          danger
          busy={busy}
          error={confirmError}
          onConfirm={() => void confirmDeleteItem()}
          onClose={() => {
            setDeletingItem(null);
            setConfirmError("");
          }}
        />
      )}
    </div>
  );
}
