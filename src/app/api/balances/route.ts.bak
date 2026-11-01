import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, sql, ne, and, inArray } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";

const round2 = (n: number) => Math.round(n * 100) / 100;

type BalanceRow = {
  clientId: string;
  name: string;
  phone: string | null;
  /** Servicios no anulados: lo que la clienta gastó en total. */
  dueUsd: number;
  /** Suma de sus pagos acreditados. */
  paidUsd: number;
  /** dueUsd - paidUsd. Negativo = sobrepago. */
  balanceUsd: number;
  /** max(0, paidUsd - dueUsd): lo que el salón guarda de más. */
  creditUsd: number;
  unpaidAppointments: number;
  items: {
    id: string;
    serviceName: string;
    price: number;
    financialStatus: string;
    completionDate: number | null;
    startTime: number | null;
    /** Para vincular el pago a una cita concreta al editarlo. */
    appointmentId: string | null;
  }[];
};

/**
 * Listado de cuentas.
 *
 * **No se filtra por saldo**: un cliente con los servicios ya pagados o con
 * sobrepago sigue apareciendo, porque su historial de pagos vive dentro de su
 * fila — ahí están los botones "Editar" y "Eliminar". El corte anterior
 * (`balance <= 0.004`) dejaba a esos clientes fuera de la respuesta y no había
 * forma de alcanzarles un pago mal registrado: el caso típico es un pago de
 * $1000 contra un servicio de $10, que hunde el saldo y esconde la fila entera.
 *
 * El orden agrupa: primero quien debe (mayor deuda), luego al día, y al final
 * los saldos a favor con el crédito más grande arriba.
 */
export async function GET() {
  const session = await auth();
  if (!(await hasPermission(session, "balances"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dueRows = db
    .select({
      userId: schema.servicePurchases.userId,
      due: sql<number>`sum(${schema.servicePurchases.servicePrice})`,
      unpaid: sql<number>`count(*)`,
    })
    .from(schema.servicePurchases)
    .where(ne(schema.servicePurchases.financialStatus, "void"))
    .groupBy(schema.servicePurchases.userId)
    .all();

  const paidRows = db
    .select({
      userId: schema.payments.userId,
      paid: sql<number>`sum(${schema.payments.amountUsd})`,
    })
    .from(schema.payments)
    .groupBy(schema.payments.userId)
    .all();

  const dueMap = new Map<string, { due: number; unpaid: number }>();
  for (const d of dueRows) dueMap.set(d.userId, { due: d.due ?? 0, unpaid: d.unpaid ?? 0 });

  const paidMap = new Map<string, number>();
  for (const p of paidRows) paidMap.set(p.userId, p.paid ?? 0);

  // Unión de ambos lados: hay clientes con pagos y sin servicios registrados, y
  // al revés. Solo el lado de los deudores no los alcanza.
  const ids = [...new Set([...dueMap.keys(), ...paidMap.keys()])];
  if (ids.length === 0) {
    return NextResponse.json({ totalUsd: 0, totalCreditUsd: 0, clients: [] });
  }

  const users = db
    .select({ id: schema.users.id, name: schema.users.name, phone: schema.users.phone })
    .from(schema.users)
    .where(inArray(schema.users.id, ids))
    .all();

  const itemsByUser = new Map<string, BalanceRow["items"]>();
  for (const userId of ids) {
    itemsByUser.set(
      userId,
      db
        .select({
          id: schema.servicePurchases.id,
          serviceName: schema.servicePurchases.serviceName,
          price: schema.servicePurchases.servicePrice,
          financialStatus: schema.servicePurchases.financialStatus,
          completionDate: schema.servicePurchases.completionDate,
          startTime: schema.appointments.startTime,
          appointmentId: schema.servicePurchases.appointmentId,
        })
        .from(schema.servicePurchases)
        .leftJoin(schema.appointments, eq(schema.appointments.id, schema.servicePurchases.appointmentId))
        .where(and(eq(schema.servicePurchases.userId, userId), ne(schema.servicePurchases.financialStatus, "void")))
        .orderBy(schema.servicePurchases.createdAt)
        .all()
    );
  }

  const clients: BalanceRow[] = [];
  let totalUsd = 0;
  let totalCreditUsd = 0;

  for (const userId of ids) {
    const due = round2(dueMap.get(userId)?.due ?? 0);
    const paid = round2(paidMap.get(userId) ?? 0);
    const balanceUsd = round2(due - paid);
    const creditUsd = round2(Math.max(0, paid - due));
    // Nada que mostrar: sin servicios y sin pagos.
    if (due === 0 && paid === 0) continue;

    const user = users.find((u) => u.id === userId);
    clients.push({
      clientId: userId,
      name: user?.name ?? "Desconocido",
      phone: user?.phone ?? null,
      dueUsd: due,
      paidUsd: paid,
      balanceUsd,
      creditUsd,
      unpaidAppointments: dueMap.get(userId)?.unpaid ?? 0,
      items: itemsByUser.get(userId) ?? [],
    });

    if (balanceUsd > 0.004) totalUsd = round2(totalUsd + balanceUsd);
    if (creditUsd > 0.004) totalCreditUsd = round2(totalCreditUsd + creditUsd);
  }

  const rank = (c: BalanceRow) => (c.balanceUsd > 0.004 ? 0 : c.balanceUsd < -0.004 ? 2 : 1);
  clients.sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    if (rank(a) === 0) return b.balanceUsd - a.balanceUsd;
    if (rank(a) === 2) return b.creditUsd - a.creditUsd;
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json({ totalUsd, totalCreditUsd, clients });
}
