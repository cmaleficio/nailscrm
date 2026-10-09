import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";
import { logActivity } from "./audit";
import { nameSimilarity, NAME_MATCH_THRESHOLD } from "./name-match";

export type MergeDb = ReturnType<typeof drizzle<typeof schema>>;

export interface MergeClientsInput {
  /** Fila que se absorbe: sus datos se mueven y luego se elimina. */
  absorbedId: string;
  /** Fila que sobrevive: recibe citas, pagos, saldo y notas. */
  survivingId: string;
  actorId?: string | null;
  actorName?: string | null;
  /**
   * Exigir similitud de nombres (auto-servicio desde el registro
   * o el perfil). La fusión del admin es una elección explícita
   * y no la exige.
   */
  requireSimilarity?: boolean;
}

export interface MergeClientsResult {
  absorbedId: string;
  survivingId: string;
  movedAppointments: number;
  movedCancelled: number;
  movedPayments: number;
  movedPurchases: number;
  movedReceipts: number;
  movedWaitlist: number;
  movedEnrollments: number;
}

export class MergeClientsError extends Error {}

/**
 * Fusiona dos clientas en una sola fila. Todo el historial
 * (citas, pagos, compras, capturas, lista de espera, cursos)
 * pasa de `absorbedId` a `survivingId` y la fila absorbida
 * se elimina. La sesión de quien se registra no se invalida:
 * por eso en auto-servicio la fila que sobrevive es la de la
 * sesión y la absorbida es la clienta ya existente.
 *
 * Las columnas de *actor* (`created_by`, `cancelled_by`,
 * `reviewed_by`, `actor_id`, `updated_by`) NO se tocan:
 * registran quién hizo la operación original, no de quién es
 * el expediente.
 */
export function mergeClientInto(
  db: MergeDb,
  input: MergeClientsInput
): MergeClientsResult {
  const { absorbedId, survivingId } = input;
  if (!absorbedId || !survivingId) {
    throw new MergeClientsError("Falta el id de una de las clientas");
  }
  if (absorbedId === survivingId) {
    throw new MergeClientsError("No se puede fusionar una clienta consigo misma");
  }

  const absorbed = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, absorbedId))
    .get();
  if (!absorbed) throw new MergeClientsError("La clienta a fusionar no existe");

  const surviving = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, survivingId))
    .get();
  if (!surviving) throw new MergeClientsError("La clienta que sobrevive no existe");

  if (absorbed.role !== "client" || surviving.role !== "client") {
    throw new MergeClientsError("No se pueden fusionar cuentas de admin");
  }
  if (absorbed.lockedAt || surviving.lockedAt) {
    throw new MergeClientsError("No se puede fusionar una cuenta bloqueada");
  }
  if (input.requireSimilarity) {
    if (nameSimilarity(absorbed.name, surviving.name) < NAME_MATCH_THRESHOLD) {
      throw new MergeClientsError(
        "Los nombres no son suficientemente parecidos para unir las cuentas"
      );
    }
    if (absorbed.email.toLowerCase() === surviving.email.toLowerCase()) {
      throw new MergeClientsError("Ambas cuentas ya comparten el mismo correo");
    }
  }

  const result: MergeClientsResult = {
    absorbedId,
    survivingId,
    movedAppointments: 0,
    movedCancelled: 0,
    movedPayments: 0,
    movedPurchases: 0,
    movedReceipts: 0,
    movedWaitlist: 0,
    movedEnrollments: 0,
  };

  db.transaction((tx) => {
    // Conteos antes de mover: para la respuesta y el log.
    result.movedAppointments = tx
      .select({ id: schema.appointments.id })
      .from(schema.appointments)
      .where(eq(schema.appointments.clientId, absorbedId))
      .all().length;
    result.movedCancelled = tx
      .select({ id: schema.cancelledAppointments.id })
      .from(schema.cancelledAppointments)
      .where(eq(schema.cancelledAppointments.clientId, absorbedId))
      .all().length;
    result.movedPayments = tx
      .select({ id: schema.payments.id })
      .from(schema.payments)
      .where(eq(schema.payments.userId, absorbedId))
      .all().length;
    result.movedPurchases = tx
      .select({ id: schema.servicePurchases.id })
      .from(schema.servicePurchases)
      .where(eq(schema.servicePurchases.userId, absorbedId))
      .all().length;
    result.movedReceipts = tx
      .select({ id: schema.paymentReceipts.id })
      .from(schema.paymentReceipts)
      .where(eq(schema.paymentReceipts.clientId, absorbedId))
      .all().length;
    result.movedWaitlist = tx
      .select({ id: schema.waitlist.id })
      .from(schema.waitlist)
      .where(eq(schema.waitlist.clientId, absorbedId))
      .all().length;

    // Campos escalares: solo rellena lo que la sobreviviente no
    // tiene, para no sobrescribir datos de la cuenta que sigue
    // activa. Las notas técnicas se concatenan para no perder
    // las de la fila absorbida.
    const patch: Partial<typeof schema.users.$inferSelect> = {
      totalVisits: (surviving.totalVisits ?? 0) + (absorbed.totalVisits ?? 0),
      totalRevenue:
        Math.round(
          ((surviving.totalRevenue ?? 0) + (absorbed.totalRevenue ?? 0)) * 100
        ) / 100,
      createdAt:
        surviving.createdAt != null &&
        absorbed.createdAt != null &&
        absorbed.createdAt < surviving.createdAt
          ? absorbed.createdAt
          : surviving.createdAt,
    };
    if (!surviving.phone && absorbed.phone) patch.phone = absorbed.phone;
    if (!surviving.address && absorbed.address) patch.address = absorbed.address;
    if (!surviving.passwordHash && absorbed.passwordHash) {
      patch.passwordHash = absorbed.passwordHash;
    }
    if (!surviving.googleId && absorbed.googleId) patch.googleId = absorbed.googleId;
    if (absorbed.techNotes) {
      const date = new Date().toISOString().slice(0, 10);
      patch.techNotes = surviving.techNotes
        ? `${surviving.techNotes}\n\n[Fusionado ${date} desde ${absorbed.name}]\n${absorbed.techNotes}`
        : absorbed.techNotes;
    }
    tx.update(schema.users).set(patch).where(eq(schema.users.id, survivingId)).run();

    // FK de propiedad: lo que es *de* la clienta se mueve.
    tx.update(schema.appointments)
      .set({ clientId: survivingId })
      .where(eq(schema.appointments.clientId, absorbedId))
      .run();
    tx.update(schema.cancelledAppointments)
      .set({ clientId: survivingId })
      .where(eq(schema.cancelledAppointments.clientId, absorbedId))
      .run();
    tx.update(schema.waitlist)
      .set({ clientId: survivingId })
      .where(eq(schema.waitlist.clientId, absorbedId))
      .run();
    tx.update(schema.servicePurchases)
      .set({ userId: survivingId })
      .where(eq(schema.servicePurchases.userId, absorbedId))
      .run();
    tx.update(schema.payments)
      .set({ userId: survivingId })
      .where(eq(schema.payments.userId, absorbedId))
      .run();
    tx.update(schema.paymentReceipts)
      .set({ clientId: survivingId })
      .where(eq(schema.paymentReceipts.clientId, absorbedId))
      .run();

    // Mantiene las sesiones y vínculos OAuth de la fila absorbida
    // vivos: quien entre con ese Google sigue entrando, ahora a
    // la fila que sobrevive.
    tx.update(schema.sessions)
      .set({ userId: survivingId })
      .where(eq(schema.sessions.userId, absorbedId))
      .run();
    tx.update(schema.accounts)
      .set({ userId: survivingId })
      .where(eq(schema.accounts.userId, absorbedId))
      .run();

    // Inscripciones de curso: el índice único es
    // (appointment_id, client_id), así que si ambas estaban
    // inscritas en la misma sesión se descarta la de la
    // absorbida (la de la sobreviviente ya está).
    const survivingEnrollmentIds = tx
      .select({ appointmentId: schema.courseEnrollments.appointmentId })
      .from(schema.courseEnrollments)
      .where(eq(schema.courseEnrollments.clientId, survivingId))
      .all()
      .map((e) => e.appointmentId);
    if (survivingEnrollmentIds.length > 0) {
      tx.delete(schema.courseEnrollments)
        .where(
          and(
            eq(schema.courseEnrollments.clientId, absorbedId),
            inArray(schema.courseEnrollments.appointmentId, survivingEnrollmentIds)
          )
        )
        .run();
    }
    result.movedEnrollments = tx
      .select({ id: schema.courseEnrollments.id })
      .from(schema.courseEnrollments)
      .where(eq(schema.courseEnrollments.clientId, absorbedId))
      .all().length;
    tx.update(schema.courseEnrollments)
      .set({ clientId: survivingId })
      .where(eq(schema.courseEnrollments.clientId, absorbedId))
      .run();

    tx.delete(schema.users).where(eq(schema.users.id, absorbedId)).run();
  });

  // El log va después del commit: `logActivity` es best-effort
  // y el objeto de transacción no expone `$client`. Si falla
  // aquí, la fusión ya quedó hecha.
  logActivity(db, {
    entity: "clients",
    action: "merge",
    entityId: absorbedId,
    label: `Cliente fusionado: ${absorbed.name} → ${surviving.name}`,
    metadata: {
      absorbedId,
      absorbedName: absorbed.name,
      absorbedEmail: absorbed.email,
      survivingId,
      survivingName: surviving.name,
      movedAppointments: result.movedAppointments,
      movedPayments: result.movedPayments,
      movedPurchases: result.movedPurchases,
      movedReceipts: result.movedReceipts,
      movedWaitlist: result.movedWaitlist,
      movedEnrollments: result.movedEnrollments,
      movedCancelled: result.movedCancelled,
    },
    actorId: input.actorId ?? null,
    actorName: input.actorName ?? null,
  });

  return result;
}
