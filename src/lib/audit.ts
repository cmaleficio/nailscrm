import { and, asc, desc, eq, like, sql, type SQL } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";
import { activityLogs } from "@/db/schema";

type DB = BetterSQLite3Database<typeof schema>;

export const AUDIT_ENTITIES = [
  "appointment",
  "service",
  "service_purchase",
  "payment",
  "payment_receipt",
  "supplier",
  "bill",
  "expense_category",
  "supplier_payment",
  "bank_account",
  "inventory_item",
  "inventory_movement",
  "client",
  "waitlist",
  "workout_block",
  "course_session",
  "gallery_photo",
  "user",
  "admin",
  "brand_settings",
  "nav_items",
  "legal_settings",
  "risc_alert",
] as const;

export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

export const AUDIT_ACTIONS = ["create", "update", "delete", "complete", "mark_payed", "approve", "reject"] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEvent {
  entity: AuditEntity;
  action: AuditAction;
  entityId?: string;
  label: string;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
  actorName?: string | null;
}

export function logActivity(dbc: DB, ev: AuditEvent): void {
  try {
    dbc.insert(activityLogs).values({
      id: crypto.randomUUID(),
      actorId: ev.actorId ?? null,
      actorName: ev.actorName ?? null,
      entity: ev.entity,
      action: ev.action,
      entityId: ev.entityId ?? null,
      label: ev.label,
      metadata: ev.metadata ? JSON.stringify(ev.metadata) : null,
      createdAt: Math.floor(Date.now() / 1000),
    }).run();
  } catch (err) {
    console.error("logActivity: no se pudo registrar el evento de auditoría", err);
  }
}

export interface ActivityLogFilters {
  entity?: string;
  action?: string;
  actorId?: string;
  query?: string;
  offset?: number;
  limit?: number;
  order?: "asc" | "desc";
}

export interface ActivityLogsResult {
  items: Array<Record<string, unknown>>;
  total: number;
  hasMore: boolean;
  nextOffset: number | null;
}

export function listActivityLogs(dbc: DB, filters: ActivityLogFilters = {}): ActivityLogsResult {
  const conditions: SQL[] = [];
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);
  const offset = Math.max(filters.offset ?? 0, 0);
  const order: "asc" | "desc" = filters.order ?? "desc";

  if (filters.entity) conditions.push(eq(activityLogs.entity, filters.entity));
  if (filters.action) conditions.push(eq(activityLogs.action, filters.action));
  if (filters.actorId) conditions.push(eq(activityLogs.actorId, filters.actorId));
  if (filters.query) conditions.push(like(activityLogs.label, `%${filters.query}%`));

  const where = conditions.length ? and(...conditions) : undefined;

  const orderBy =
    order === "asc"
      ? [asc(activityLogs.createdAt), asc(activityLogs.id)]
      : [desc(activityLogs.createdAt), desc(activityLogs.id)];

  const rows = dbc.select().from(activityLogs).where(where).orderBy(...orderBy).limit(limit + 1).offset(offset).all();
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  const totalRows = dbc.select({ count: sql<number>`count(*)` }).from(activityLogs).where(where).get();
  const total = totalRows?.count ?? 0;

  return {
    items: items as Array<Record<string, unknown>>,
    total,
    hasMore,
    nextOffset: hasMore ? offset + limit : null,
  };
}

export function listActivityActors(dbc: DB) {
  return dbc
    .select({
      actorId: activityLogs.actorId,
      actorName: activityLogs.actorName,
    })
    .from(activityLogs)
    .where(sql`${activityLogs.actorId} is not null`)
    .groupBy(activityLogs.actorId, activityLogs.actorName)
    .orderBy(sql`max(${activityLogs.createdAt}) desc`)
    .all();
}