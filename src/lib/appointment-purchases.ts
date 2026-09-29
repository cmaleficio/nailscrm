export type PurchaseSummaryRow = {
  id: string;
  appointmentId: string | null;
  userId: string;
  serviceName: string;
  servicePrice: number;
  serviceDurationMins: number;
  isPrimary: number | null;
};

export type AppointmentSummaryRow = {
  id: string;
  clientId: string;
  serviceName: string;
};

export type PurchaseSummaryItem = {
  id: string;
  name: string;
  price: number;
  durationMins: number;
  isPrimary: number | null;
};

export type PurchaseSummary = {
  serviceName: string;
  serviceNames: string[];
  servicePrice: number;
  isComplementaryOnly: boolean;
  hasPrincipal: boolean;
  /** Una fila por compra del grupo, no por cita: es lo que la UI lista. */
  items: PurchaseSummaryItem[];
};

/** Lo mínimo que necesita el recálculo de la cita al quitar un servicio. */
export type RemainingPurchase = {
  id: string;
  serviceId: string | null;
  serviceName: string;
  servicePrice: number;
  serviceDurationMins: number;
  isPrimary: number | null;
};

type SortablePurchase = { serviceName: string; isPrimary: number | null };

// Principal primero; las complementarias por nombre. Es el mismo criterio con el
// que se compone el título de la cita, así que la lista y el título no pueden
// contradecirse.
function comparePurchaseRows(a: SortablePurchase, b: SortablePurchase): number {
  const pa = a.isPrimary === 1 ? 0 : 1;
  const pb = b.isPrimary === 1 ? 0 : 1;
  if (pa !== pb) return pa - pb;
  return a.serviceName.localeCompare(b.serviceName, "es");
}

function toItem(r: {
  id: string;
  serviceName: string;
  servicePrice: number;
  serviceDurationMins: number;
  isPrimary: number | null;
}): PurchaseSummaryItem {
  return {
    id: r.id,
    name: r.serviceName,
    price: r.servicePrice,
    durationMins: r.serviceDurationMins,
    isPrimary: r.isPrimary,
  };
}

/**
 * Colapsa N filas de service_purchases en UNA fila por cita.
 *
 * Invariante: ninguna lectura de citas debe multiplicar filas por
 * service_purchases. Ver docs/superpowers/specs/2026-09-28-appointment-purchase-fanout-design.md
 *
 * Una cita puede tener N compras de dos maneras distintas:
 *  - varios servicios del MISMO cliente (principal + complementarios): se suman.
 *  - N clientes distintos (sesión de curso, una compra por alumno): solo cuenta
 *    el grupo de appointments.client_id, si no el precio saldría precio x alumnos.
 */
/**
 * Elige el grupo de compras que representa a la cita.
 *
 * Se agrupa por user_id porque las dos formas de "N compras en una cita" se
 * distinguen justamente por eso:
 *  - multi-servicio: todas las compras son del MISMO cliente, hay un solo grupo
 *    y la cita entera es ese grupo.
 *  - curso: una compra por alumno, un grupo por alumno. appointments.client_id
 *    apunta al primer alumno inscrito, así que su grupo es el de la sesión.
 *
 * Si client_id no corresponde a ningún grupo (cita heredada, o alumno desinscrito
 * que ya no tiene compra) se decide por forma: un solo grupo es una cita
 * multi-servicio y se suma entero; varios grupos son un curso y se toma uno solo,
 * porque sumarlos daría precio x alumnos.
 */
function pickGroup(rows: PurchaseSummaryRow[], clientId: string | null): PurchaseSummaryRow[] {
  const groups = new Map<string, PurchaseSummaryRow[]>();
  for (const r of rows) {
    const list = groups.get(r.userId);
    if (list) list.push(r);
    else groups.set(r.userId, [r]);
  }

  const own = clientId ? groups.get(clientId) : undefined;
  if (own) return own;

  const first = groups.values().next();
  if (groups.size === 1) return first.value as PurchaseSummaryRow[];
  return (first.value as PurchaseSummaryRow[]).slice(0, 1);
}

export function summarizePurchases(
  appointments: AppointmentSummaryRow[],
  purchases: PurchaseSummaryRow[]
): Map<string, PurchaseSummary> {
  const byAppointment = new Map<string, PurchaseSummaryRow[]>();
  for (const p of purchases) {
    // Las compras huérfanas (appointment_id null) no pertenecen a ninguna cita.
    if (!p.appointmentId) continue;
    const list = byAppointment.get(p.appointmentId);
    if (list) list.push(p);
    else byAppointment.set(p.appointmentId, [p]);
  }

  const out = new Map<string, PurchaseSummary>();

  for (const appt of appointments) {
    const rows = byAppointment.get(appt.id);
    if (!rows || rows.length === 0) {
      out.set(appt.id, {
        serviceName: appt.serviceName,
        serviceNames: [appt.serviceName],
        servicePrice: 0,
        isComplementaryOnly: false,
        hasPrincipal: false,
        items: [],
      });
      continue;
    }

    const clientId = (appt as { clientId?: string | null }).clientId;
    const chosen = pickGroup(rows, clientId ?? null);

    const sorted = [...chosen].sort(comparePurchaseRows);

    const names = sorted.map((r) => r.serviceName);
    out.set(appt.id, {
      serviceName: names.join(" + "),
      serviceNames: names,
      servicePrice: sorted.reduce((acc, r) => acc + (r.servicePrice || 0), 0),
      isComplementaryOnly: sorted.every((r) => r.isPrimary !== 1),
      hasPrincipal: sorted.some((r) => r.isPrimary === 1),
      items: sorted.map(toItem),
    });
  }

  return out;
}

/**
 * Recalcula la combinación de una cita a partir de las compras que quedan.
 * Es pura a propósito: el endpoint la usa para decidir `end_time` y el ancla
 * antes de borrar nada, y los tests la pueden ejercitar sin base de datos.
 * `anchorServiceId` es el `service_id` de la primera compra que lo tenga, que es
 * el "el primero manda" de siempre; con compras huérfanas queda en null y el
 * llamador conserva el ancla anterior.
 */
export function remainingCombination(purchases: RemainingPurchase[]): {
  items: PurchaseSummaryItem[];
  names: string[];
  totalDurationMins: number;
  totalPrice: number;
  anchorServiceId: string | null;
} {
  const ordered = [...purchases].sort(comparePurchaseRows);
  return {
    items: ordered.map(toItem),
    names: ordered.map((p) => p.serviceName),
    totalDurationMins: ordered.reduce((acc, p) => acc + (p.serviceDurationMins || 0), 0),
    totalPrice: ordered.reduce((acc, p) => acc + (p.servicePrice || 0), 0),
    anchorServiceId: ordered.find((p) => p.serviceId)?.serviceId ?? null,
  };
}
