import { NextResponse } from "next/server";
import { getTodayRate } from "@/lib/bcv";

export async function GET() {
  const { rate, source } = await getTodayRate();
  return NextResponse.json({ rate, source });
}
