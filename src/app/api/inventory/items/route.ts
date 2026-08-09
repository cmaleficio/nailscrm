import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, sql } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1";
  const rows = includeInactive
    ? db.select().from(schema.inventoryItems).orderBy(schema.inventoryItems.name).all()
    : db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.isActive, 1)).orderBy(schema.inventoryItems.name).all();

  const usageRows = db
    .select({
      inventoryItemId: schema.serviceProducts.inventoryItemId,
      qty: sql<number>`sum(${schema.serviceProducts.quantityPerService})`,
    })
    .from(schema.serviceProducts)
    .groupBy(schema.serviceProducts.inventoryItemId)
    .all();
  const usageMap = new Map<string, number>();
  for (const u of usageRows) usageMap.set(u.inventoryItemId, u.qty ?? 0);

  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      stockValue: Math.round(r.stock * r.avgCost * 100) / 100,
      estUsos: (() => {
        const total = usageMap.get(r.id) ?? 0;
        return total > 0 ? Math.round((r.stock / total) * 10) / 10 : null;
      })(),
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }
  const row = {
    id: crypto.randomUUID(),
    name,
    unit: typeof body.unit === "string" && body.unit.trim() ? body.unit.trim() : "unidad",
    stock: 0,
    avgCost: 0,
    minStock: typeof body.minStock === "number" && body.minStock >= 0 ? body.minStock : 0,
    isActive: 1,
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    createdAt: Math.floor(Date.now() / 1000),
  };
  db.insert(schema.inventoryItems).values(row).run();
  return NextResponse.json(row, { status: 201 });
}
