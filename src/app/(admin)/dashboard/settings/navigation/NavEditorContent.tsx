"use client";

import { useEffect, useState } from "react";

type NavItem = {
  id: string;
  label: string;
  href: string;
  position: number;
  isActive: number;
  openInNewTab: number;
};

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

export function NavEditorContent() {
  const [items, setItems] = useState<NavItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/nav-items")
      .then((r) => r.json())
      .then((data: NavItem[]) => setItems(data))
      .catch(() => setError("No se pudo cargar la navegación"))
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof NavItem>(idx: number, key: K, value: NavItem[K]) {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        id: `nav-${crypto.randomUUID().slice(0, 8)}`,
        label: "",
        href: "",
        position: prev.length,
        isActive: 1,
        openInNewTab: 0,
      },
    ]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveItem(idx: number, direction: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= next.length) return prev;
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      next.forEach((item, i) => {
        item.position = i;
      });
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const payload = items.map((item) => ({
        id: item.id,
        label: item.label,
        href: item.href,
        position: item.position,
        isActive: item.isActive === 1,
        openInNewTab: item.openInNewTab === 1,
      }));
      const res = await fetch("/api/admin/nav-items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar");
      }
      const data: NavItem[] = await res.json();
      setItems(data);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-gray-500">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menú de navegación</h1>
          <p className="text-sm text-gray-500">
            Enlaces visibles en la barra superior (escritorio)
          </p>
        </div>
        <a
          href="/dashboard/settings"
          className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          ← Configuración
        </a>
      </div>

      <div className="space-y-3">
        {items.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
            Aún no hay elementos. Agrega el primero con el botón de abajo.
          </div>
        )}
        {items.map((item, idx) => (
          <div
            key={item.id}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-gray-400">
                #{idx + 1}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveItem(idx, -1)}
                  disabled={idx === 0}
                  className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                  title="Subir"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(idx, 1)}
                  disabled={idx === items.length - 1}
                  className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                  title="Bajar"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="rounded-lg p-1 text-red-500 hover:bg-red-50"
                  title="Eliminar"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Etiqueta
                </label>
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => update(idx, "label", e.target.value)}
                  className={inputCls}
                  placeholder="Inicio"
                  maxLength={50}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Enlace
                </label>
                <input
                  type="text"
                  value={item.href}
                  onChange={(e) => update(idx, "href", e.target.value)}
                  className={inputCls}
                  placeholder="/inicio"
                  maxLength={200}
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-600">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.isActive === 1}
                  onChange={(e) => update(idx, "isActive", e.target.checked ? 1 : 0)}
                  className="h-4 w-4 rounded border-gray-300 text-pink-main focus:ring-pink-main"
                />
                Visible
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.openInNewTab === 1}
                  onChange={(e) =>
                    update(idx, "openInNewTab", e.target.checked ? 1 : 0)
                  }
                  className="h-4 w-4 rounded border-gray-300 text-pink-main focus:ring-pink-main"
                />
                Abrir en pestaña nueva
              </label>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addItem}
        className="mt-4 w-full rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50"
      >
        + Agregar elemento
      </button>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
      {saved && (
        <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600">
          Menú guardado
        </p>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="mt-4 w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
      >
        {saving ? "Guardando..." : "Guardar menú"}
      </button>
    </div>
  );
}