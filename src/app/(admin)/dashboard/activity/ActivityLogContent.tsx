"use client";

import { useState, useEffect, useCallback } from "react";

type ActivityItem = {
  id: string;
  actorId: string | null;
  actorName: string | null;
  entity: string;
  action: string;
  entityId: string | null;
  label: string;
  metadata: string | null;
  createdAt: number;
};

const ACTION_STYLES: Record<string, string> = {
  create: "bg-green-100 text-green-700",
  update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
  cancel: "bg-red-100 text-red-700",
  complete: "bg-emerald-100 text-emerald-700",
  approve: "bg-emerald-100 text-emerald-700",
  reject: "bg-red-100 text-red-700",
  report: "bg-purple-100 text-purple-700",
  adjust: "bg-amber-100 text-amber-700",
  enroll: "bg-cyan-100 text-cyan-700",
  unenroll: "bg-orange-100 text-orange-700",
  void: "bg-gray-200 text-gray-600",
};

const ENTITY_LABELS: Record<string, string> = {
  appointments: "Citas",
  course_sessions: "Sesiones de curso",
  course_enrollments: "Inscripciones a curso",
  services: "Servicios",
  service_photos: "Fotos de servicio",
  gallery_photos: "Fotos del muro",
  service_products: "Uso por servicio",
  users: "Usuarios",
  clients: "Clientes",
  admins: "Admins",
  waitlist: "Lista de espera",
  blockouts: "Bloqueos",
  working_hours: "Horario",
  purchases: "Servicios realizados",
  payments: "Pagos",
  payment_receipts: "Capturas de pago",
  exchange_rates: "Tasas",
  suppliers: "Proveedores",
  expense_categories: "Categorías de gasto",
  bank_accounts: "Bancos",
  bills: "Facturas",
  supplier_payments: "Pagos a proveedores",
  inventory_items: "Inventario",
  inventory_movements: "Movimientos de inventario",
  risc_events: "Seguridad (RISC)",
  brand_settings: "Identidad",
  nav_items: "Navegación",
  legal_settings: "Legal",
  tracking_tags: "Analítica",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Creación",
  update: "Actualización",
  delete: "Borrado",
  cancel: "Cancelación",
  complete: "Completar",
  approve: "Aprobación",
  reject: "Rechazo",
  report: "Reporte",
  adjust: "Ajuste",
  enroll: "Inscripción",
  unenroll: "Baja",
  void: "Anulación",
};

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ActivityLogContent() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actors, setActors] = useState<{ actorId: string; actorName: string | null }[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draft, setDraft] = useState({ entity: "", action: "", actor: "", from: "", to: "", q: "" });
  const [filters, setFilters] = useState(draft);

  const runQuery = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.entity) params.set("entity", filters.entity);
        if (filters.action) params.set("action", filters.action);
        if (filters.actor) params.set("actor", filters.actor);
        if (filters.from)
          params.set("from", String(Math.floor(new Date(`${filters.from}T00:00:00`).getTime() / 1000)));
        if (filters.to)
          params.set("to", String(Math.floor(new Date(`${filters.to}T23:59:59`).getTime() / 1000)));
        if (filters.q.trim()) params.set("q", filters.q.trim());
        params.set("limit", "50");
        params.set("offset", String(nextOffset));
        const res = await fetch(`/api/activity-logs?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        setItems((prev) => (nextOffset === 0 ? data.items : [...prev, ...data.items]));
        setOffset(data.nextOffset ?? nextOffset + data.items.length);
        setHasMore(data.hasMore);
        setTotal(data.total);
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    void runQuery(0);
  }, [runQuery]);

  useEffect(() => {
    const onRefresh = () => void runQuery(0);
    window.addEventListener("activity:refresh", onRefresh);
    return () => window.removeEventListener("activity:refresh", onRefresh);
  }, [runQuery]);

  useEffect(() => {
    fetch("/api/activity-logs/actors")
      .then((r) => r.json())
      .then((data) => setActors(Array.isArray(data) ? data : []))
      .catch(() => setActors([]));
  }, []);

  const selectCls =
    "rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700";
  const inputCls = `${selectCls} w-full max-w-[10rem]`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-gray-900">Log de actividad</h1>
        <span className="text-sm text-gray-500">{total} registros</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 bg-white p-3">
        <select
          className={selectCls}
          value={draft.entity}
          onChange={(e) => setDraft({ ...draft, entity: e.target.value })}
        >
          <option value="">Todas las entidades</option>
          {Object.entries(ENTITY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          className={selectCls}
          value={draft.action}
          onChange={(e) => setDraft({ ...draft, action: e.target.value })}
        >
          <option value="">Todas las acciones</option>
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          className={selectCls}
          value={draft.actor}
          onChange={(e) => setDraft({ ...draft, actor: e.target.value })}
        >
          <option value="">Todos los usuarios</option>
          {actors.map((a) => (
            <option key={a.actorId} value={a.actorId}>{a.actorName ?? "Usuario"}</option>
          ))}
        </select>
        <input
          type="date"
          className={inputCls}
          value={draft.from}
          onChange={(e) => setDraft({ ...draft, from: e.target.value })}
        />
        <input
          type="date"
          className={inputCls}
          value={draft.to}
          onChange={(e) => setDraft({ ...draft, to: e.target.value })}
        />
        <input
          type="text"
          placeholder="Buscar por detalle…"
          className={inputCls}
          value={draft.q}
          onChange={(e) => setDraft({ ...draft, q: e.target.value })}
        />
        <button
          onClick={() => setFilters(draft)}
          className="rounded-lg bg-pink-main px-3 py-1.5 text-sm font-medium text-gray-900 hover:opacity-90"
        >
          Filtrar
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase text-gray-400">
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Usuario</th>
                <th className="px-3 py-2">Acción</th>
                <th className="px-3 py-2">Entidad</th>
                <th className="px-3 py-2">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <FragmentRow
                  key={it.id}
                  item={it}
                  expanded={expanded === it.id}
                  onToggle={() => setExpanded(expanded === it.id ? null : it.id)}
                />
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                    Sin registros con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <button
            onClick={() => void runQuery(offset)}
            disabled={loading}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {loading ? "Cargando…" : "Cargar más"}
          </button>
        </div>
      )}
    </div>
  );
}

function FragmentRow({
  item,
  expanded,
  onToggle,
}: {
  item: ActivityItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  let parsed: unknown = null;
  if (item.metadata) {
    try {
      parsed = JSON.parse(item.metadata);
    } catch {
      parsed = item.metadata;
    }
  }
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-gray-50 hover:bg-gray-50"
      >
        <td className="whitespace-nowrap px-3 py-2 text-gray-600">{formatDate(item.createdAt)}</td>
        <td className="px-3 py-2 font-medium text-gray-900">{item.actorName ?? "—"}</td>
        <td className="px-3 py-2">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
              ACTION_STYLES[item.action] ?? "bg-gray-100 text-gray-600"
            }`}
          >
            {ACTION_LABELS[item.action] ?? item.action}
          </span>
        </td>
        <td className="px-3 py-2 text-gray-600">{ENTITY_LABELS[item.entity] ?? item.entity}</td>
        <td className="px-3 py-2 text-gray-800">{item.label}</td>
      </tr>
      {expanded && (
        <tr className="border-b border-gray-100 bg-gray-50">
          <td colSpan={5} className="px-3 py-3">
            <pre className="whitespace-pre-wrap break-words text-xs text-gray-700">
              {parsed == null ? "Sin metadatos." : JSON.stringify(parsed, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}