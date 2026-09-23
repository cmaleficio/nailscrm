import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/index";
import { hasPermission } from "@/lib/authz";
import { listActivityActors } from "@/lib/audit";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!(await hasPermission(session, "activityLog"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.json(listActivityActors(db));
}