import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { getRateByDate } from "@/lib/bcv";

export async function GET(request: Request) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || undefined;
  const result = await getRateByDate(date || new Date().toISOString().slice(0, 10));
  return NextResponse.json(result);
}