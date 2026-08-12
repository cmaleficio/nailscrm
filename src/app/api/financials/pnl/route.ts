import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authz";
import { getPnL } from "@/lib/financials";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await hasPermission(session, "financials"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const month = req.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month (YYYY-MM) es requerido" }, { status: 400 });
  }
  return NextResponse.json(getPnL(month));
}
