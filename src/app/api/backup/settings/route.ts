import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({ enabled: false });
}
export async function PUT() {
  return NextResponse.json({ ok: true });
}
