"use client";

import { useMemo, useState } from "react";
import { round2 } from "@/lib/payment-edit";

export type EditableAppointment = {
  id: string;
  label: string;
};

/**
 * Lo que el diálogo necesita saber de un pago. Es un subconjunto deliberado del
 * que devuelve `GET /api/payments`: la UI no necesita el `createdBy` ni el
 * `createdAt`, y no debe poder editarlos aunque vinieran en el objeto.
 */
export type EditablePayment = {
  id: string;
  userId: string;
  clientName: string;
  currency: "USD" | "VES";
  amountUsd: number;
  amountVes: number | null;
  rate: number | null;
  paidAt: number | null;
  appointmentId: string | null;
};

type Props = {
  payment: EditablePayment;
  /** Citas de la misma clienta, para el selector de vínculo. */
  appointments?: EditableAppointment[];
  /** Balance actual en USD; se usa solo para la vista previa del saldo. */
  balanceUsd?: number | null;
  /** Bloquea cantidad y moneda: el pago viene de una captura y esa cifra es la reporte. */
  lockAmount?: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

const tsToDateStr = (ts: number | null): string => {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Editar un pago acreditado. Solo toca cifras, fecha y cita: la referencia, las
 * notas y la foto son el registro de cómo entró el dinero y no se editan, y la
 * moneda tampoco (convertir un pago cambiaría el saldo histórico de la clienta).
 *
 * Los tres campos numéricos arrancan vacíos a propósito. Es la forma de que "no lo
 * toques" sea la opción por defecto en vez de tener que adivinar si el valor que
 * viene en pantalla es el que el admin quiere dejar: si no escribe nada, el body
 * no lleva la clave y la ruta conserva la cifra.
 */
export function EditPaymentDialog({
  payment,
  appointments = [],
  balanceUsd = null,
  lockAmount = false,
  onClose,
  onSaved,
}: Props) {
  const [amountVes, setAmountVes] = useState("");
  const [rate, setRate] = useState("");
  const [amountUsd, setAmountUsd] = useState("");
  const [paidDate, setPaidDate] = useState(tsToDateStr(payment.paidAt));
  const [appointmentId, setAppointmentId] = useState(payment.appointmentId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isVes = payment.currency === "VES";
  const parsedVes = parseFloat(amountVes);
  const parsedRate = parseFloat(rate);
  const parsedUsd = parseFloat(amountUsd);

  // El dólar explícito manda sobre el Bs, igual que en `resolvePaymentAmount`. El
  // preview replica esa precedencia para no prometer una cifra que la ruta vaya a
  // calcular de otra forma.
  const preview = useMemo(() => {
    if (Number.isFinite(parsedUsd) && parsedUsd > 0) return round2(parsedUsd);
    if (isVes && Number.isFinite(parsedVes) && parsedVes > 0 && Number.isFinite(parsedRate) && parsedRate > 0) {
      return round2(parsedVes / parsedRate);
    }
    return null;
  }, [parsedUsd, parsedVes, parsedRate, isVes]);

  const delta = preview !== null ? round2(preview - payment.amountUsd) : null;
  const newBalance = balanceUsd !== null && delta !== null ? round2(balanceUsd - delta) : null;

  async function submit() {
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {};

      // Solo se envían las claves que el admin rellenó. Vacío = no lo toques.
      if (amountVes.trim() !== "" || rate.trim() !== "") {
        body.amountVes = amountVes.trim() === "" ? payment.amountVes : parseFloat(amountVes);
        body.rate = rate.trim() === "" ? payment.rate : parseFloat(rate);
      }
      if (amountUsd.trim() !== "") body.amountUsd = parseFloat(amountUsd);
      if (paidDate && paidDate !== tsToDateStr(payment.paidAt)) body.paidAt = paidDate;
      // Tricestado: vacío = no tocar, "__none__" = desvincular, id = vincular.
      if (appointmentId !== (payment.appointmentId ?? "")) {
        body.appointmentId = appointmentId === "" ? null : appointmentId;
      }

      if (Object.keys(body).length === 0) {
        onSaved();
        return;
      }

      const res = await fetch(`/api/payments/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo editar el pago");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">Editar pago</h3>
        <p className="mt-1 text-sm text-gray-500">{payment.clientName}</p>
        <p className="mt-1 text-xs text-gray-400">
          Se acreditó <span className="font-medium text-gray-600">${payment.amountUsd.toFixed(2)}</span>
          {isVes && payment.amountVes !== null && ` · ${payment.amountVes} Bs`}
          {isVes && payment.rate !== null && ` @ ${payment.rate} Bs/US$`}
        </p>

        {lockAmount && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Este pago vino de una captura aprobada. Si cambias el monto, la captura deja de
            coincidir con lo acreditado y la clienta lo verá en &quot;Mis pagos&quot;.
          </p>
        )}

        {isVes ? (
          <>
            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Monto en Bs <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amountVes}
                onChange={(e) => setAmountVes(e.target.value)}
                placeholder={payment.amountVes?.toString() ?? "Monto en Bs"}
                className={inputCls}
              />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Tasa Bs/US$ <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder={payment.rate?.toString() ?? "Tasa"}
                className={inputCls}
              />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Total en USD <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                placeholder={payment.amountUsd.toFixed(2)}
                className={inputCls}
              />
              <p className="mt-1 text-xs text-gray-400">
                Si lo escribes, manda sobre el Bs y la tasa. Déjalo vacío para recalcular.
              </p>
            </div>
          </>
        ) : (
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Monto en USD <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountUsd}
              onChange={(e) => setAmountUsd(e.target.value)}
              placeholder={payment.amountUsd.toFixed(2)}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-gray-400">
              El pago está en dólares: no hay Bs ni tasa que cambiar.
            </p>
          </div>
        )}

        {preview !== null && delta !== null && (
          <div className="mt-4 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <div>
              Nuevo total:{" "}
              <span className="font-semibold text-gray-900">${preview.toFixed(2)}</span>
              {delta !== 0 && (
                <span className={delta > 0 ? "ml-2 text-green-600" : "ml-2 text-red-600"}>
                  ({delta > 0 ? "+" : ""}${delta.toFixed(2)})
                </span>
              )}
            </div>
            {newBalance !== null && (
              <div className="mt-0.5">
                Balance de la clienta:{" "}
                <span className="font-semibold text-gray-900">${newBalance.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">Fecha del pago</label>
          <input
            type="date"
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
            className={inputCls}
          />
        </div>

        {appointments.length > 0 && (
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-gray-600">Cita vinculada</label>
            <select
              value={appointmentId}
              onChange={(e) => setAppointmentId(e.target.value)}
              className={inputCls}
            >
              <option value="">Sin cita</option>
              {appointments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
        )}

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
            className="flex-1 rounded-xl bg-pink-main px-4 py-2 text-sm font-medium text-white hover:bg-pink-dark disabled:opacity-50 transition-colors"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}