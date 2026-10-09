"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { maskPhone, type NameCandidate } from "@/lib/name-match";

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-pink-main focus:outline-none";

type Props = {
  initialName: string;
  /**
   * Clientas con nombre similar calculadas en el servidor.
   * Vacía cuando el interruptor está apagado o no hay
   * coincidencias.
   */
  candidates: NameCandidate[];
};

export function CompleteRegistrationForm({ initialName, candidates }: Props) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState("");
  const [claimedName, setClaimedName] = useState("");

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

  async function handleClaim(candidate: NameCandidate) {
    setClaimingId(candidate.id);
    setClaimError("");
    try {
      const res = await fetch("/api/identity/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: candidate.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo unir el expediente");
      }
      // El servidor copió teléfono/Notas del expediente reclamado
      // a esta cuenta; al refrescar, la página redirige a /profile.
      setClaimedName(candidate.name);
      router.refresh();
    } catch (err) {
      setClaimError(
        err instanceof Error ? err.message : "Error inesperado"
      );
      setClaimingId(null);
    }
  }

  const showCandidates = candidates.length > 0 && !dismissed && !claimedName;

  return (
    <div className="space-y-3">
      {claimedName && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          Tu cuenta quedó unida al expediente de <strong>{claimedName}</strong>.
          Redirigiendo a tu perfil...
        </div>
      )}

      {showCandidates && (
        <div className="rounded-xl border border-pink-200 bg-pink-50 p-4">
          <h2 className="text-sm font-semibold text-gray-900">
            ¿Ya eres cliente de nuestro salón?
          </h2>
          <p className="mt-1 text-xs text-gray-600">
            Encontramos clientas con un nombre similar. Si es tu expediente,
            únelo para conservar tus citas, pagos y saldo. Si no es tuya,
            continúa como cliente nueva.
          </p>
          <ul className="mt-3 space-y-2">
            {candidates.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-pink-100 bg-white px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {c.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {maskPhone(c.phone)} · {c.totalVisits ?? 0}{" "}
                    {c.totalVisits === 1 ? "visita" : "visitas"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleClaim(c)}
                  disabled={claimingId !== null}
                  className="shrink-0 rounded-lg bg-pink-main px-3 py-1.5 text-xs font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50 transition-colors"
                >
                  {claimingId === c.id ? "Uniendo..." : "Soy yo"}
                </button>
              </li>
            ))}
          </ul>
          {claimError && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {claimError}
            </p>
          )}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="mt-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            No soy ninguna de estas, soy cliente nueva
          </button>
        </div>
      )}

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
    </div>
  );
}
