import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";
import { recomputeFinancialStatus } from "@/lib/financial-status";
import { logActivity } from "@/lib/audit";
import { resolvePaymentAmount } from "@/lib/payment-edit";
import { dateToDayStartTs } from "@/lib/time";

type RouteParams = { params: Promise<{ id: string }> };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Editar y borrar pagos ya acreditados.
 *
 * Un pago se puede corregir porque el saldo de la clienta se calcula en vivo sobre
 * estas filas, y una cifra mal puesta se propaga a cuentas por cobrar, al P&L y a
 * los estados financieros. Se editan solo las cifras y la fecha: referencia, notas
 * y foto son el registro de origen y no se tocan, y la moneda tampoco (convertir
 * un pago cambiaria el saldo historico de la clienta).
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await hasPermission(session, "balances"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const payment = db.select().from(schema.payments).where(eq(schema.payments.id, id)).get();
  if (!payment) {
    return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
  }

  const body = await req.json();

  // --- Cifras -----------------------------------------------------------------
  // Solo se recalculan si el body trae alguna; un PATCH de fecha no debe tocar el
  // monto. La aritmetica vive en `resolvePaymentAmount` (funciones puras + tests).
  let amounts = {
    amountUsd: payment.amountUsd,
    amountVes: payment.amountVes,
    rate: payment.rate,
  };
  const touchesAmounts =
    body.amountUsd !== undefined || body.amountVes !== undefined || body.rate !== undefined;
  if (touchesAmounts) {
    const resolved = resolvePaymentAmount(
      {
        amountUsd: payment.amountUsd,
        amountVes: payment.amountVes,
        rate: payment.rate,
        currency: payment.currency === "VES" ? "VES" : "USD",
      },
      {
        amountUsd: body.amountUsd,
        amountVes: body.amountVes,
        rate: body.rate,
      }
    );
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }
    amounts = {
      amountUsd: resolved.amountUsd,
      amountVes: resolved.amountVes,
      rate: resolved.rate,
    };
  }

  // --- Fecha ------------------------------------------------------------------
  // El formulario manda "YYYY-MM-DD" y se guarda a inicio del dia en la zona del
  // salon, igual que `POST /api/payments`. Si no viene, no se toca la fecha.
  let paidAt = payment.paidAt;
  if (body.paidAt !== undefined) {
    if (typeof body.paidAt !== "string" || !DATE_RE.test(body.paidAt)) {
      return NextResponse.json(
        { error: "paidAt debe ser una fecha YYYY-MM-DD" },
        { status: 400 }
      );
    }
    const ts = dateToDayStartTs(body.paidAt);
    if (!Number.isFinite(ts)) {
      return NextResponse.json({ error: "paidAt no es una fecha válida" }, { status: 400 });
    }
    paidAt = ts;
  }

  // --- Cita -------------------------------------------------------------------
  // Tricestado: ausente = no tocar, null = desvincular, string = vincular. Igual
  // que en `POST`, y solo a una cita de la misma clienta.
  let appointmentId = payment.appointmentId;
  if (body.appointmentId !== undefined) {
    if (body.appointmentId === null) {
      appointmentId = null;
    } else if (typeof body.appointmentId === "string") {
      const appt = db
        .select({ clientId: schema.appointments.clientId })
        .from(schema.appointments)
        .where(eq(schema.appointments.id, body.appointmentId))
        .get();
      if (!appt || appt.clientId !== payment.userId) {
        return NextResponse.json(
          { error: "La cita no pertenece al cliente" },
          { status: 400 }
        );
      }
      appointmentId = body.appointmentId;
    } else {
      return NextResponse.json({ error: "appointmentId inválido" }, { status: 400 });
    }
  }

  db.update(schema.payments)
    .set({ ...amounts, paidAt, appointmentId })
    .where(eq(schema.payments.id, id))
    .run();

  recomputeFinancialStatus(payment.userId);

  const before = {
    amountUsd: payment.amountUsd,
    amountVes: payment.amountVes,
    rate: payment.rate,
    paidAt: payment.paidAt,
    appointmentId: payment.appointmentId,
  };
  const after = { ...amounts, paidAt, appointmentId };
  const changed = (Object.keys(after) as (keyof typeof after)[]).some(
    (k) => after[k] !== before[k]
  );

  logActivity(db, {
    entity: "payments",
    action: "update",
    entityId: payment.id,
    label: `Pago editado: $${after.amountUsd} (${payment.currency})`,
    metadata: { before, after, changed, userId: payment.userId },
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });

  return NextResponse.json({ ...payment, ...after });
}

/**
 * Borrar un pago. Si venía de una captura aprobada hay que des-hacer la aprobación
 * primero: `payment_receipts.payment_id` es `ON DELETE NO ACTION` y SQLite tiene
 * `foreign_keys = ON`, así que borrar el pago sin más revienta con
 * SQLITE_CONSTRAINT_FOREIGNKEY y el admin se queda sin forma de deshacer una
 * aprobación equivocada.
 *
 * La captura vuelve a `pending` conservando la evidencia y los campos del review
 * anterior (`reviewedBy`, `reviewedAt`, `reviewNotes`), para que al volver a
 * aprobarla se vea el historial y no quede un aprobado sin pago que lo respalde.
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await hasPermission(session, "balances"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const payment = db.select().from(schema.payments).where(eq(schema.payments.id, id)).get();
  if (!payment) {
    return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
  }

  const receipts = db
    .select({
      id: schema.paymentReceipts.id,
      status: schema.paymentReceipts.status,
      amountVes: schema.paymentReceipts.amountVes,
      reviewedBy: schema.paymentReceipts.reviewedBy,
      reviewedAt: schema.paymentReceipts.reviewedAt,
    })
    .from(schema.paymentReceipts)
    .where(eq(schema.paymentReceipts.paymentId, id))
    .all();

  db.transaction((tx) => {
    for (const receipt of receipts) {
      tx.update(schema.paymentReceipts)
        .set({ status: "pending", paymentId: null })
        .where(eq(schema.paymentReceipts.id, receipt.id))
        .run();
    }
    tx.delete(schema.payments).where(eq(schema.payments.id, id)).run();
  });

  recomputeFinancialStatus(payment.userId);

  logActivity(db, {
    entity: "payments",
    action: "delete",
    entityId: payment.id,
    label: `Pago eliminado: $${payment.amountUsd} (${payment.currency})`,
    metadata: {
      userId: payment.userId,
      amountVes: payment.amountVes,
      resetReceipts: receipts.map((r) => r.id),
    },
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });

  // Una fila por captura: el log de actividad tiene que dejar claro que la
  // aprobación se deshizo, no que solo se borró un pago suelto.
  for (const receipt of receipts) {
    logActivity(db, {
      entity: "payment_receipts",
      action: "update",
      entityId: receipt.id,
      label: `Captura de pago devuelta a pendientes al eliminar su pago: ${receipt.amountVes} Bs`,
      metadata: {
        paymentId: id,
        previousStatus: receipt.status,
        reviewedBy: receipt.reviewedBy,
        reviewedAt: receipt.reviewedAt,
      },
      actorId: session?.user?.id,
      actorName: session?.user?.name ?? null,
    });
  }

  return NextResponse.json({ success: true, resetReceipts: receipts.length });
}