"use client";

import { useEffect, useState } from "react";

type MergeClient = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  totalVisits: number | null;
  totalRevenue: number | null;
};

type Props = {
  /**
   * Clienta abierta por el admin: es la fila que se
   * absorbe (se elimina). Todos sus datos pasan a la
   * clienta elegida.
   */
  client: MergeClient;
  onClose: () => void;
  /** Llamada tras la fusión: el padre recarga la lista y cierra el panel. */
  onMerged: () => void;
};

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-pink-main focus:outline-none";

/**
 * Diálogo "Fusionar clientes" (admin, permiso
 * `mergeClients`). La clienta abierta (A) se elimina y
 * todo su historial —citas, pagos, compras, capturas,
 * lista de espera, cursos, saldo y notas— pasa a la
 * clienta elegida (B), que sobrevive. El recuadro de
 * resumen muestra explícitamente quién se va y quién
 * sobrevive antes de confirmar.
 */
export function MergeClientsDialog({ client, onClose, onMerged }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<MergeClient[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<MergeClient | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      setSearching(true);
      fetch(`/api/clients?q=${encodeURIComponent(q.trim())}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data: MergeClient[]) =>
          setResults(data.filter((c) => c.id !== client.id))
        )
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q, client.id]);

  async function handleMerge() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/merge-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          absorbedId: client.id,
          survivingId: selected.id,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo fusionar");
      }
      onMerged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">
          Fusionar clientes
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Mueve todo el historial de una clienta a otra y elimina la
          duplicada. Busca la clienta que <strong>sobrevive</strong>.
        </p>

        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSelected(null);
          }}
          placeholder="Buscar por nombre, email o teléfono..."
          className={inputCls + " mt-4"}
          autoFocus
        />
        {searching && (
          <p className="mt-2 text-xs text-gray-400">Buscando...</p>
        )}

        {selected ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Resumen de la fusión
            </p>
            <div className="mt-2 space-y-2 text-sm">
              <p>
                <span className="font-medium text-red-700">
                  Se ELIMINA (clienta A):
                </span>{" "}
                {client.name} — {client.totalVisits ?? 0}{" "}
                {client.totalVisits === 1 ? "visita" : "visitas"}, $
                {(client.totalRevenue ?? 0).toFixed(2)}
              </p>
              <p>
                <span className="font-medium text-green-700">
                  SOBREVIVE (clienta B):
                </span>{" "}
                {selected.name} — {selected.totalVisits ?? 0}{" "}
                {selected.totalVisits === 1 ? "visita" : "visitas"}, $
                {(selected.totalRevenue ?? 0).toFixed(2)}
              </p>
              <p className="text-xs text-gray-600">
                Citas, pagos, compras, capturas, lista de espera, cursos,
                saldo y notas de <strong>{client.name}</strong> se moverán a{" "}
                <strong>{selected.name}</strong>. Si {selected.name} no tiene
                teléfono, dirección o contraseña, hereda los de{" "}
                {client.name}. Las notas técnicas de ambas se conservan
                concatenadas.
              </p>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => void handleMerge()}
                disabled={busy}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {busy ? "Fusionando..." : "Sí, fusionar"}
              </button>
              <button
                onClick={() => setSelected(null)}
                disabled={busy}
                className="rounded-xl bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Elegir otra
              </button>
            </div>
          </div>
        ) : (
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {results.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelected(c)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-left hover:border-pink-main hover:bg-pink-50 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900">
                    {c.name}
                  </p>
                  <p className="truncate text-xs text-gray-500">{c.email}</p>
                  <p className="text-xs text-gray-500">
                    {c.totalVisits ?? 0}{" "}
                    {c.totalVisits === 1 ? "visita" : "visitas"} · $
                    {(c.totalRevenue ?? 0).toFixed(2)}
                  </p>
                </button>
              </li>
            ))}
            {q.trim() && !searching && results.length === 0 && (
              <li className="rounded-xl border-2 border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
                No se encontraron clientas
              </li>
            )}
          </ul>
        )}

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-xl bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
