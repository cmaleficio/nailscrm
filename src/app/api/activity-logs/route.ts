import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authz";
import { db } from "@/db/index";
import { listActivityLogs, AUDIT_ENTITIES, AUDIT_ACTIONS } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id || !(await hasPermission(session, "activityLog"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const entity = sp.get("entity") || undefined;
  const action = sp.get("action") || undefined;
  const actorId = sp.get("actorId") || undefined;
  const query = sp.get("query") || undefined;
  const offset = Number(sp.get("offset")) || 0;
  const limit = Number(sp.get("limit")) || 25;
  const order = sp.get("order") === "asc" ? "asc" : "desc";

  if (entity && !(AUDIT_ENTITIES as readonly string[]).includes(entity)) {
    return NextResponse.json({ error: "entity no válida" }, { status: 400 });
  }
  if (action && !(AUDIT_ACTIONS as readonly string[]).includes(action)) {
    return NextResponse.json({ error: "action no válida" }, { status: 400 });
  }

  const result = listActivityLogs(db, { entity, action, actorId, query, offset, limit, order });

  return NextResponse.json(result);
}