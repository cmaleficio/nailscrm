import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPermissions } from "@/lib/authz";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const permissions = await getPermissions(session);
  return NextResponse.json({ permissions });
}
