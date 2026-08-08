"use client";

import { useState, useEffect, useCallback } from "react";

type Admin = {
  id: string;
  email: string;
  name: string | null;
  isPrimary?: boolean;
};

export function AdminUsersContent() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchAdmins = useCallback(async () => {
    const res = await fetch("/api/admins");
    if (res.ok) {
      setAdmins(await res.json());
    }
  }, []);

  useEffect(() => {
    void fetchAdmins();
  }, [fetchAdmins]);

  async function handleAdd() {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await fetch("/api/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo añadir admin");
      }
      setEmail("");
      setSuccess("Admin añadido");
      await fetchAdmins();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(adminEmail: string) {
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admins", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo quitar admin");
      }
      setSuccess("Admin removido");
      await fetchAdmins();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Administradores</h1>
        <p className="text-sm text-gray-500">
          Administra usuarios que pueden acceder al panel.
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Añadir admin por email
        </label>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@email.com"
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
          <button
            onClick={handleAdd}
            disabled={loading || !email}
            className="rounded-xl bg-pink-main px-6 py-2 text-sm font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50 transition-colors"
          >
            {loading ? "Añadiendo..." : "Añadir"}
          </button>
        </div>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        {success && (
          <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600">
            {success}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {admins.map((admin) => {
          const isSelf = admin.isPrimary;
          return (
            <div
              key={admin.id}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4"
            >
              <div>
                <p className="font-medium text-gray-900">
                  {admin.name || "Usuario"}
                  {isSelf && (
                    <span className="ml-2 rounded bg-pink-light px-2 py-0.5 text-xs font-medium text-pink-700">
                      Principal
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-500">{admin.email}</p>
              </div>
              <button
                onClick={() => handleRemove(admin.email)}
                disabled={isSelf}
                className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Quitar admin
              </button>
            </div>
          );
        })}
        {admins.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
            <p className="text-gray-400">No hay administradores</p>
          </div>
        )}
      </div>
    </div>
  );
}