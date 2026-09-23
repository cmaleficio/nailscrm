import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authz";
import { db } from "@/db/index";
import { listActivityActors } from "@/lib/audit";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id || !(await hasPermission(session, "activityLog"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const actors = listActivityActors(db).map((a) => ({
    actorId: a.actorId as string,
    actorName: a.actorName,
  }));

  return NextResponse.json(actors);
}