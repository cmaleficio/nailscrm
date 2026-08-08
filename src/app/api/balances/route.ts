import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, sql } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

export async function GET() {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dueRows = db
    .select({
      userId: schema.servicePurchases.userId,
      due: sql<number>`sum(${schema.servicePurchases.servicePrice})`,
      unpaid: sql<number>`count(*)`,
    })
    .from(schema.servicePurchases)
    .innerJoin(
      schema.appointments,
      eq(schema.appointments.id, schema.servicePurchases.appointmentId)
    )
    .where(eq(schema.appointments.status, "completed"))
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

  const paidMap = new Map<string, number>();
  for (const p of paidRows) paidMap.set(p.userId, p.paid ?? 0);

  const clients: {
    clientId: string;
    name: string;
    phone: string | null;
    balanceUsd: number;
    unpaidAppointments: number;
  }[] = [];

  let totalUsd = 0;
  for (const d of dueRows) {
    const balance = Math.round(((d.due ?? 0) - (paidMap.get(d.userId) ?? 0)) * 100) / 100;
    if (balance <= 0.004) continue;
    const user = db
      .select({ name: schema.users.name, phone: schema.users.phone })
      .from(schema.users)
      .where(eq(schema.users.id, d.userId))
      .get();
    clients.push({
      clientId: d.userId,
      name: user?.name ?? "Desconocido",
      phone: user?.phone ?? null,
      balanceUsd: balance,
      unpaidAppointments: d.unpaid ?? 0,
    });
    totalUsd = Math.round((totalUsd + balance) * 100) / 100;
  }

  clients.sort((a, b) => b.balanceUsd - a.balanceUsd);

  return NextResponse.json({ totalUsd, clients });
}
