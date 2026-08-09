import { db, schema } from "@/db/index";
import { eq, sql, and, gte, lt } from "drizzle-orm";
import { dateTimeToTs } from "@/lib/time";

export type PnLResult = {
  month: string;
  income: number;
  expenses: number;
  profit: number;
  servicesCount: number;
  invoicesCount: number;
  incomeByService: { serviceName: string; amount: number; count: number }[];
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
  const inMonth = and(gte(schema.appointments.startTime, start), lt(schema.appointments.startTime, end));

  const incomeRow = db
    .select({
      total: sql<number>`coalesce(sum(${schema.servicePurchases.servicePrice}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(schema.servicePurchases)
    .innerJoin(schema.appointments, eq(schema.appointments.id, schema.servicePurchases.appointmentId))
    .where(and(eq(schema.appointments.status, "completed"), inMonth))
    .get();

  const incomeByService = db
    .select({
      serviceName: schema.servicePurchases.serviceName,
      amount: sql<number>`sum(${schema.servicePurchases.servicePrice})`,
      count: sql<number>`count(*)`,
    })
    .from(schema.servicePurchases)
    .innerJoin(schema.appointments, eq(schema.appointments.id, schema.servicePurchases.appointmentId))
    .where(and(eq(schema.appointments.status, "completed"), inMonth))
    .groupBy(schema.servicePurchases.serviceName)
    .all();

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

  const income = round2(incomeRow?.total ?? 0);
  const expenses = round2(expensesRow?.total ?? 0);
  return {
    month,
    income,
    expenses,
    profit: round2(income - expenses),
    servicesCount: incomeRow?.count ?? 0,
    invoicesCount: expensesRow?.count ?? 0,
    incomeByService: incomeByService.map((r) => ({
      serviceName: r.serviceName,
      amount: round2(r.amount ?? 0),
      count: r.count ?? 0,
    })),
    expensesByCategory,
  };
}
