import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await hasPermission(session, "appointments"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const appointmentId = searchParams.get("appointmentId");
  const userId = searchParams.get("userId");

  if (appointmentId) {
    const purchase = db
      .select()
      .from(schema.servicePurchases)
      .where(eq(schema.servicePurchases.appointmentId, appointmentId))
      .get();
    return NextResponse.json(purchase ?? null);
  }

  if (userId) {
    const purchases = db
      .select()
      .from(schema.servicePurchases)
      .where(eq(schema.servicePurchases.userId, userId))
      .orderBy(schema.servicePurchases.createdAt)
      .all();
    return NextResponse.json(purchases);
  }

  return NextResponse.json(
    { error: "appointmentId or userId is required" },
    { status: 400 }
  );
}