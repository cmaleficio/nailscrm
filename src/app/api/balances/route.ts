import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, sql, ne, and } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";

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

  const paidMap = new Map<string, number>();
  for (const p of paidRows) paidMap.set(p.userId, p.paid ?? 0);

  const clients: {
    clientId: string;
    name: string;
    phone: string | null;
    balanceUsd: number;
    unpaidAppointments: number;
    items: {
      id: string;
      serviceName: string;
      price: number;
      financialStatus: string;
      completionDate: number | null;
      startTime: number | null;
    }[];
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
    const items = db
      .select({
        id: schema.servicePurchases.id,
        serviceName: schema.servicePurchases.serviceName,
        price: schema.servicePurchases.servicePrice,
        financialStatus: schema.servicePurchases.financialStatus,
        completionDate: schema.servicePurchases.completionDate,
        startTime: schema.appointments.startTime,
      })
      .from(schema.servicePurchases)
      .leftJoin(schema.appointments, eq(schema.appointments.id, schema.servicePurchases.appointmentId))
      .where(and(eq(schema.servicePurchases.userId, d.userId), ne(schema.servicePurchases.financialStatus, "void")))
      .orderBy(schema.servicePurchases.createdAt)
      .all();
    clients.push({
      clientId: d.userId,
      name: user?.name ?? "Desconocido",
      phone: user?.phone ?? null,
      balanceUsd: balance,
      unpaidAppointments: d.unpaid ?? 0,
      items,
    });
    totalUsd = Math.round((totalUsd + balance) * 100) / 100;
  }

  clients.sort((a, b) => b.balanceUsd - a.balanceUsd);

  return NextResponse.json({ totalUsd, clients });
}
