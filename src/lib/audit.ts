import { and, desc, eq, like, sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";

export type AuditDb = ReturnType<typeof drizzle<typeof schema>>;

export const AUDIT_ENTITIES = [
  "appointments", "appointment_usage", "course_sessions", "course_enrollments",
  "services", "service_photos", "gallery_photos", "service_products",
  "users", "clients", "admins", "waitlist", "blockouts", "working_hours",
  "purchases", "payments", "payment_receipts", "exchange_rates",
  "suppliers", "expense_categories", "bank_accounts", "bills", "supplier_payments",
  "inventory_items", "inventory_movements", "risc_events",
  "brand_settings", "nav_items", "legal_settings", "tracking_tags",
  "app_settings",
] as const;

export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

export const AUDIT_ACTIONS = [
  "create", "update", "delete", "cancel", "complete",
  "approve", "reject", "report", "adjust", "enroll", "unenroll", "void",
  "merge",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type LogActivityParams = {
  entity: AuditEntity;
  action: AuditAction;
  entityId?: string | null;
  label: string;
  metadata?: Record<string, unknown> | null;
  actorId?: string | null;
  actorName?: string | null;
};

export function logActivity(dbc: AuditDb, params: LogActivityParams): void {
  try {
    let metadata: string | null = null;
    if (params.metadata != null) {
      try {
        metadata = JSON.stringify(params.metadata);
      } catch {
        metadata = null;
      }
    }
    dbc.insert(schema.activityLogs).values({
      id: crypto.randomUUID(),
      actorId: params.actorId ?? null,
      actorName: params.actorName ?? null,
      entity: params.entity,
      action: params.action,
      entityId: params.entityId ?? null,
      label: params.label,
      metadata,
      createdAt: Math.floor(Date.now() / 1000),
    }).run();
  } catch (err) {
    console.error("logActivity failed:", err);
  }
}

export type ActivityLogFilters = {
  entity?: string | null;
  action?: string | null;
  actor?: string | null;
  from?: number | null;
  to?: number | null;
  q?: string | null;
  limit?: number;
  offset?: number;
};

export function listActivityLogs(dbc: AuditDb, filters: ActivityLogFilters = {}) {
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
  const offset = Math.max(Number(filters.offset) || 0, 0);
  const conditions: SQL[] = [];
  if (filters.entity) conditions.push(eq(schema.activityLogs.entity, filters.entity));
  if (filters.action) conditions.push(eq(schema.activityLogs.action, filters.action));
  if (filters.actor) conditions.push(eq(schema.activityLogs.actorId, filters.actor));
  if (filters.from != null) conditions.push(sql`${schema.activityLogs.createdAt} >= ${filters.from}`);
  if (filters.to != null) conditions.push(sql`${schema.activityLogs.createdAt} <= ${filters.to}`);
  if (filters.q && filters.q.trim()) {
    conditions.push(like(schema.activityLogs.label, `%${filters.q.trim()}%`));
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const total =
    dbc.select({ n: sql<number>`count(*)` }).from(schema.activityLogs).where(where).get()?.n ?? 0;
  const items = dbc
    .select({
      id: schema.activityLogs.id,
      actorId: schema.activityLogs.actorId,
      actorName: schema.activityLogs.actorName,
      entity: schema.activityLogs.entity,
      action: schema.activityLogs.action,
      entityId: schema.activityLogs.entityId,
      label: schema.activityLogs.label,
      metadata: schema.activityLogs.metadata,
      createdAt: schema.activityLogs.createdAt,
    })
    .from(schema.activityLogs)
    .where(where)
    .orderBy(desc(schema.activityLogs.createdAt))
    .limit(limit)
    .offset(offset)
    .all();
  const hasMore = offset + items.length < total;
  return { items, total, hasMore, nextOffset: hasMore ? offset + items.length : null };
}

export function listActivityActors(dbc: AuditDb) {
  return dbc
    .select({
      actorId: schema.activityLogs.actorId,
      actorName: schema.activityLogs.actorName,
    })
    .from(schema.activityLogs)
    .where(sql`${schema.activityLogs.actorId} is not null`)
    .groupBy(schema.activityLogs.actorId)
    .all();
}