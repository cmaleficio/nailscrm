import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, sql } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await hasPermission(session, "inventory"))) {
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
  if (!(await hasPermission(session, "inventory"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }
  if (!/^[A-Za-z0-9_-]+$/.test(code)) {
    return NextResponse.json({ error: "El código de producto es requerido y solo admite letras, números, guiones y guiones bajos" }, { status: 400 });
  }
  const exists = db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.id, code)).get();
  if (exists) {
    return NextResponse.json({ error: "Ya existe un producto con ese código" }, { status: 400 });
  }
  const barcode = typeof body.barcode === "string" && body.barcode.trim() ? body.barcode.trim() : null;
  const photoUrl = typeof body.photoUrl === "string" && body.photoUrl.trim() ? body.photoUrl.trim() : null;
  const row = {
    id: code,
    name,
    unit: typeof body.unit === "string" && body.unit.trim() ? body.unit.trim() : "unidad",
    stock: 0,
    avgCost: 0,
    minStock: typeof body.minStock === "number" && body.minStock >= 0 ? body.minStock : 0,
    isActive: 1,
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    barcode,
    photoUrl,
    createdAt: Math.floor(Date.now() / 1000),
  };
  db.insert(schema.inventoryItems).values(row).run();
  return NextResponse.json(row, { status: 201 });
}
