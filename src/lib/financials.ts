import { db, schema } from "@/db/index";
import { eq, sql, and, gte, lt, ne, isNotNull } from "drizzle-orm";
import { dateTimeToTs } from "@/lib/time";

export type PnLResult = {
  month: string;
  recaudacion: {
    income: number;
    servicesCount: number;
    incomeByService: { serviceName: string; amount: number; count: number }[];
  };
  produccion: {
    income: number;
    servicesCount: number;
    incomeByService: { serviceName: string; amount: number; count: number }[];
  };
  expenses: number;
  profitRecaudacion: number;
  profitProduccion: number;
  invoicesCount: number;
  expensesByCategory: { categoryName: string; amount: number }[];
};

export function monthRange(month: string): { start: number; end: number } {
  const [y, m] = month.split("-").map((n) => parseInt(n, 10));
  const start = dateTimeToTs(`${month}-01`, "00:00");
  const next = new Date(Date.UTC(y, m - 1, 1));
  next.setUTCMonth(next.getUTCMonth() + 1);
  const nextMonth = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
  return { start, end: dateTimeToTs(`${nextMonth}-01`, "00:00") };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function getPnL(month: string): PnLResult {
  const { start, end } = monthRange(month);
  const notVoid = ne(schema.servicePurchases.financialStatus, "void");

  const recaudRow = db
    .select({
      total: sql<number>`coalesce(sum(${schema.payments.amountUsd}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(schema.payments)
    .where(and(gte(schema.payments.paidAt, start), lt(schema.payments.paidAt, end)))
    .get();

  const recaudByService = db
    .select({
      serviceName: schema.servicePurchases.serviceName,
      amount: sql<number>`sum(${schema.payments.amountUsd})`,
      count: sql<number>`count(*)`,
    })
    .from(schema.payments)
    .innerJoin(
      schema.servicePurchases,
      eq(schema.servicePurchases.appointmentId, schema.payments.appointmentId)
    )
    .where(and(gte(schema.payments.paidAt, start), lt(schema.payments.paidAt, end)))
    .groupBy(schema.servicePurchases.serviceName)
    .all()
    .map((r) => ({
      serviceName: r.serviceName ?? "Sin servicio",
      amount: round2(r.amount ?? 0),
      count: r.count ?? 0,
    }));

  const prodRow = db
    .select({
      total: sql<number>`coalesce(sum(${schema.servicePurchases.servicePrice}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(schema.servicePurchases)
    .where(and(notVoid, isNotNull(schema.servicePurchases.appointmentId), gte(schema.servicePurchases.completionDate, start), lt(schema.servicePurchases.completionDate, end)))
    .get();

  const prodByService = db
    .select({
      serviceName: schema.servicePurchases.serviceName,
      amount: sql<number>`sum(${schema.servicePurchases.servicePrice})`,
      count: sql<number>`count(*)`,
    })
    .from(schema.servicePurchases)
    .where(and(notVoid, isNotNull(schema.servicePurchases.appointmentId), gte(schema.servicePurchases.completionDate, start), lt(schema.servicePurchases.completionDate, end)))
    .groupBy(schema.servicePurchases.serviceName)
    .all()
    .map((r) => ({
      serviceName: r.serviceName,
      amount: round2(r.amount ?? 0),
      count: r.count ?? 0,
    }));

  const expensesRow = db
    .select({
      total: sql<number>`coalesce(sum(${schema.bills.totalUsd}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(schema.bills)
    .where(and(gte(schema.bills.billDate, start), lt(schema.bills.billDate, end)))
    .get();

  const expensesByCategory = db
    .select({
      categoryName: schema.expenseCategories.name,
      amount: sql<number>`sum(${schema.bills.totalUsd})`,
    })
    .from(schema.bills)
    .leftJoin(schema.expenseCategories, eq(schema.expenseCategories.id, schema.bills.categoryId))
    .where(and(gte(schema.bills.billDate, start), lt(schema.bills.billDate, end)))
    .groupBy(schema.bills.categoryId)
    .all()
    .map((r) => ({ categoryName: r.categoryName ?? "Sin categoría", amount: round2(r.amount ?? 0) }));

  const recaudacion = round2(recaudRow?.total ?? 0);
  const produccion = round2(prodRow?.total ?? 0);
  const expenses = round2(expensesRow?.total ?? 0);

  return {
    month,
    recaudacion: {
      income: recaudacion,
      servicesCount: recaudRow?.count ?? 0,
      incomeByService: recaudByService,
    },
    produccion: {
      income: produccion,
      servicesCount: prodRow?.count ?? 0,
      incomeByService: prodByService,
    },
    expenses,
    profitRecaudacion: round2(recaudacion - expenses),
    profitProduccion: round2(produccion - expenses),
    invoicesCount: expensesRow?.count ?? 0,
    expensesByCategory,
  };
}