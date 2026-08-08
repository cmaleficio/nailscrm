import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { getTodayRate } from "@/lib/bcv";

export async function GET() {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { rate, source } = await getTodayRate();
  return NextResponse.json({ rate, source });
}
