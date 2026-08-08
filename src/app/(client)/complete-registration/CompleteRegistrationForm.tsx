"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-pink-main focus:outline-none";

export function CompleteRegistrationForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) {
      setError("El número de teléfono es requerido");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), address: address.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar");
      }
      router.push("/profile");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Nombre</label>
        <input value={initialName} disabled className={inputCls + " bg-gray-50 text-gray-500"} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Teléfono (WhatsApp) <span className="text-red-500">*</span>
        </label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+58 412 123 4567"
          className={inputCls}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Dirección (opcional)</label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Tu dirección"
          className={inputCls}
        />
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-pink-main px-6 py-2.5 text-sm font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50 transition-colors"
      >
        {saving ? "Guardando..." : "Guardar y continuar"}
      </button>
    </form>
  );
}
