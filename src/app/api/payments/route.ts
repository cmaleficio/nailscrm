import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, desc, sql, and, ne, inArray } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";
import { recomputeFinancialStatus } from "@/lib/financial-status";
import { getRateByDate } from "@/lib/bcv";
import { todayStr } from "@/lib/time";
import { logActivity } from "@/lib/audit";
import { allocatePayments, type PaymentKind } from "@/lib/payment-split";
import { splitForPayment } from "@/lib/payment-split-db";

function paidAtToDateStr(paidAt: number): string {
  const d = new Date(paidAt * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await hasPermission(session, "balances"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const q = db.select().from(schema.payments);
  const rows = userId
    ? q.where(eq(schema.payments.userId, userId)).orderBy(desc(schema.payments.paidAt)).all()
    : q.orderBy(desc(schema.payments.paidAt)).all();

  // Reparto de cada pago: cuánto cubre deuda y cuánto es anticipo. Se deriva
  // al leer (sin columna ni migración) contra la deuda ACTUAL de cada clienta,
  // en orden cronológico. El saldo total no cambia por esto.
  const userIds = [...new Set(rows.map((r) => r.userId))];
  const dues = userIds.length
    ? db
        .select({
          userId: schema.servicePurchases.userId,
          due: sql<number>`coalesce(sum(${schema.servicePurchases.servicePrice}), 0)`,
        })
        .from(schema.servicePurchases)
        .where(
          and(inArray(schema.servicePurchases.userId, userIds), ne(schema.servicePurchases.financialStatus, "void"))
        )
        .groupBy(schema.servicePurchases.userId)
        .all()
    : [];
  const dueByUser = new Map<string, number>(dues.map((d) => [d.userId, d.due ?? 0]));

  // Un solo reparto por clienta (los pagos se consumen en orden cronológico):
  // repartir cada fila por separado diría que todos cubren la deuda entera.
  const allocByPaymentId = new Map<string, { appliedUsd: number; creditUsd: number; kind: PaymentKind }>();
  for (const uid of userIds) {
    const own = rows.filter((r) => r.userId === uid);
    const allocs = allocatePayments(
      dueByUser.get(uid) ?? 0,
      own.map((r) => ({ id: r.id, amountUsd: r.amountUsd, paidAt: r.paidAt, createdAt: r.createdAt }))
    );
    for (const a of allocs) {
      allocByPaymentId.set(a.id, { appliedUsd: a.appliedUsd, creditUsd: a.creditUsd, kind: a.kind });
    }
  }

  // Servicios que cubre cada pago (materializado en `payment_allocations`:
  // qué pago pagó qué compra, no derivado al leer).
  const allocRows = rows.length
    ? db
        .select({
          paymentId: schema.paymentAllocations.paymentId,
          purchaseId: schema.paymentAllocations.purchaseId,
          amountUsd: schema.paymentAllocations.amountUsd,
          serviceName: schema.servicePurchases.serviceName,
        })
        .from(schema.paymentAllocations)
        .innerJoin(
          schema.servicePurchases,
          eq(schema.servicePurchases.id, schema.paymentAllocations.purchaseId)
        )
        .where(inArray(schema.paymentAllocations.paymentId, rows.map((r) => r.id)))
        .all()
    : [];
  const allocByPayment = new Map<
    string,
    { purchaseId: string; serviceName: string; amountUsd: number }[]
  >();
  for (const a of allocRows) {
    const list = allocByPayment.get(a.paymentId) ?? [];
    list.push({ purchaseId: a.purchaseId, serviceName: a.serviceName, amountUsd: a.amountUsd });
    allocByPayment.set(a.paymentId, list);
  }

  const withSplit = rows.map((r) => ({
    ...r,
    ...(allocByPaymentId.get(r.id) ?? {}),
    allocations: allocByPayment.get(r.id) ?? [],
  }));

  return NextResponse.json(withSplit);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const adminId = session?.user?.id;
  if (!adminId || !(await hasPermission(session, "balances"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const {
    userId,
    appointmentId,
    amountUsd,
    currency,
    amountVes,
    rate,
    reference,
    paidAt,
    notes,
    photoUrl,
  } = body;

  if (!userId || typeof userId !== "string" || !userId.trim()) {
    return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
  }

  const client = db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();
  if (!client) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  if (appointmentId) {
    const appt = db
      .select({ clientId: schema.appointments.clientId })
      .from(schema.appointments)
      .where(eq(schema.appointments.id, appointmentId))
      .get();
    if (!appt || appt.clientId !== userId) {
      return NextResponse.json(
        { error: "La cita no pertenece al cliente" },
        { status: 400 }
      );
    }
  }

  const cur: "USD" | "VES" = currency === "VES" ? "VES" : "USD";
  let usd = 0;
  let effectiveRate: number | null = null;
  if (cur === "VES") {
    if (typeof amountVes !== "number" || amountVes <= 0) {
      return NextResponse.json({ error: "amountVes es requerido para pagos en Bs" }, { status: 400 });
    }
    effectiveRate = typeof rate === "number" && rate > 0 ? rate : null;
    if (!effectiveRate) {
      const paidDateStr = typeof paidAt === "number" ? paidAtToDateStr(paidAt) : todayStr();
      const fetched = await getRateByDate(paidDateStr);
      effectiveRate = fetched.rate;
    }
    if (!effectiveRate || effectiveRate <= 0) {
      return NextResponse.json({
        error: `No hay tasa BCV para la fecha ${paidAt ? paidAtToDateStr(paidAt) : todayStr()}. Regístalas en /dashboard/exchange-rates`,
      }, { status: 400 });
    }
    usd = Math.round((amountVes / effectiveRate) * 100) / 100;
  } else {
    if (typeof amountUsd !== "number" || amountUsd <= 0) {
      return NextResponse.json({ error: "amountUsd es requerido" }, { status: 400 });
    }
    usd = Math.round(amountUsd * 100) / 100;
  }

  const now = Math.floor(Date.now() / 1000);
  const payment = {
    id: crypto.randomUUID(),
    userId,
    appointmentId: appointmentId ?? null,
    amountUsd: usd,
    currency: cur,
    amountVes: cur === "VES" ? amountVes : null,
    rate: cur === "VES" ? effectiveRate : null,
    reference: typeof reference === "string" && reference.trim() ? reference.trim() : null,
    photoUrl: typeof photoUrl === "string" && photoUrl.trim() ? photoUrl.trim() : null,
    paidAt: typeof paidAt === "number" ? paidAt : now,
    notes: typeof notes === "string" ? notes : null,
    createdBy: adminId,
    createdAt: now,
  };

  db.insert(schema.payments).values(payment).run();
  recomputeFinancialStatus(payment.userId);
  const split = splitForPayment(payment.userId, payment.id);
  {
    const clientName = db
      .select({ name: schema.users.name })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .get()?.name ?? "Cliente";
    logActivity(db, {
      entity: "payments",
      action: "create",
      entityId: payment.id,
      label: `Pago registrado: ${clientName} – $${usd} (${cur})`,
      metadata: {
        usd,
        currency: cur,
        amountVes,
        rate: effectiveRate,
        appointmentId: payment.appointmentId,
        // El reparto queda en la auditoría: deja ver si un pago se acreditó
        // como anticipo o como abono en el momento en que se registró.
        appliedUsd: split.appliedUsd,
        creditUsd: split.creditUsd,
        kind: split.kind,
      },
      actorId: adminId,
      actorName: session?.user?.name ?? null,
    });
  }
  return NextResponse.json({ ...payment, ...split });
}
