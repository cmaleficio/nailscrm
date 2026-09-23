import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/index";
import { hasPermission } from "@/lib/authz";
import { listActivityLogs } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await hasPermission(session, "activityLog"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  const result = listActivityLogs(db, {
    entity: sp.get("entity"),
    action: sp.get("action"),
    actor: sp.get("actor"),
    from: from ? Number(from) : null,
    to: to ? Number(to) : null,
    q: sp.get("q"),
    limit: Number(sp.get("limit")) || 50,
    offset: Number(sp.get("offset")) || 0,
  });
  return NextResponse.json(result);
}