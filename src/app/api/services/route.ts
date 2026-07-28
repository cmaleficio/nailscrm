import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const service = db
      .select()
      .from(schema.services)
      .where(eq(schema.services.id, id))
      .get();
    if (!service) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(service);
  }

  const services = db
    .select()
    .from(schema.services)
    .where(eq(schema.services.isActive, 1))
    .all();
  return NextResponse.json(services);
}
