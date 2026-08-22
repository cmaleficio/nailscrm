import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await hasPermission(session, "appointments"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  db.delete(schema.blockouts).where(eq(schema.blockouts.id, id)).run();
  return NextResponse.json({ success: true });
}
