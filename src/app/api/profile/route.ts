import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const update: Partial<typeof schema.users.$inferSelect> = {};
  if (typeof body.phone === "string") update.phone = body.phone.trim();
  if (typeof body.address === "string") update.address = body.address.trim();
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }
  db.update(schema.users).set(update).where(eq(schema.users.id, session.user.id)).run();
  const user = db.select().from(schema.users).where(eq(schema.users.id, session.user.id)).get();
  return NextResponse.json(user);
}
