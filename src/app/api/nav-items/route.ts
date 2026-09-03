import { NextResponse } from "next/server";
import { db, schema } from "@/db/index";
import { asc, eq } from "drizzle-orm";

export async function GET() {
  const rows = db
    .select()
    .from(schema.navItems)
    .where(eq(schema.navItems.isActive, 1))
    .orderBy(asc(schema.navItems.position))
    .all();

  return NextResponse.json(rows);
}
