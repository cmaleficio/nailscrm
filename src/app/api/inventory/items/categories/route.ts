import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { hasPermission } from "@/lib/authz";
import { sql } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!(await hasPermission(session, "inventory"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const categories = db
    .selectDistinct({ category: schema.inventoryItems.category })
    .from(schema.inventoryItems)
    .where(sql`${schema.inventoryItems.category} IS NOT NULL`)
    .orderBy(schema.inventoryItems.category)
    .all();
  const subcategories = db
    .selectDistinct({ subcategory: schema.inventoryItems.subcategory })
    .from(schema.inventoryItems)
    .where(sql`${schema.inventoryItems.subcategory} IS NOT NULL`)
    .orderBy(schema.inventoryItems.subcategory)
    .all();
  return NextResponse.json({
    categories: categories.map((c) => c.category).filter((c): c is string => c !== null),
    subcategories: subcategories.map((s) => s.subcategory).filter((s): s is string => s !== null),
  });
}