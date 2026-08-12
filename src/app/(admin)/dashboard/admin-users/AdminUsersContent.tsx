"use client";

import { useState, useEffect, useCallback } from "react";
import { PERMISSION_KEYS, PERMISSION_LABELS } from "@/lib/permissions";

type Admin = {
  id: string;
  email: string;
  name: string | null;
  isPrimary?: boolean;
  permissions?: string[] | null;
};

export function AdminUsersContent() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savingPerms, setSavingPerms] = useState<string | null>(null);
  const [permError, setPermError] = useState("");

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

  async function handleSavePermissions(admin: Admin) {
    setSavingPerms(admin.email);
    setPermError("");
    try {
      const perms = admin.permissions ?? [];
      const res = await fetch("/api/admins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: admin.email, permissions: perms }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar permisos");
      }
      setSuccess("Permisos actualizados");
      await fetchAdmins();
    } catch (e) {
      setPermError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSavingPerms(null);
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
              className="rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="flex items-center justify-between">
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
              {!isSelf && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <p className="mb-2 text-xs font-medium text-gray-600">Permisos por módulo</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                    {PERMISSION_KEYS.map((key) => {
                      const checked = (admin.permissions ?? null) === null || (admin.permissions ?? []).includes(key);
                      return (
                        <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={(admin.permissions ?? null) === null}
                            onChange={() => {
                              const perms = admin.permissions ?? [];
                              const next = checked ? perms.filter((p) => p !== key) : [...perms, key];
                              setAdmins((prev) =>
                                prev.map((a) => (a.email === admin.email ? { ...a, permissions: next } : a))
                              );
                            }}
                            className="h-4 w-4"
                          />
                          {PERMISSION_LABELS[key]}
                        </label>
                      );
                    })}
                  </div>
                  {(admin.permissions ?? null) === null && (
                    <p className="mt-2 text-xs text-gray-400">Acceso a todos los módulos (por defecto).</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => {
                        setAdmins((prev) =>
                          prev.map((a) => (a.email === admin.email ? { ...a, permissions: [...PERMISSION_KEYS] } : a))
                        );
                      }}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                    >
                      Marcar todos
                    </button>
                    <button
                      onClick={() => {
                        setAdmins((prev) =>
                          prev.map((a) => (a.email === admin.email ? { ...a, permissions: [] } : a))
                        );
                      }}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                    >
                      Ninguno
                    </button>
                    <button
                      onClick={() => void handleSavePermissions(admin)}
                      disabled={savingPerms === admin.email}
                      className="rounded-lg bg-pink-main px-3 py-1.5 text-xs font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50"
                    >
                      {savingPerms === admin.email ? "Guardando..." : "Guardar permisos"}
                    </button>
                  </div>
                  {permError && <p className="mt-2 text-xs text-red-600">{permError}</p>}
                </div>
              )}
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