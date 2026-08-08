import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { todayStr } from "@/lib/time";

export function normalizeBcvNumber(s: string): number | null {
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function extractBcvUsdRate(html: string): number | null {
  const m = html.match(
    /recuadrotsmc[\s\S]*?USD[\s\S]*?<strong class="strong-tb">([\d.,]+)<\/strong>/i
  );
  if (!m) return null;
  return normalizeBcvNumber(m[1]);
}

export async function fetchBcvRate(): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(
      "https://www.bcv.org.ve/tasas-informativas-sistema-bancario",
      {
        headers: {
          "Accept-Language": "es",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    const file = path.join(os.tmpdir(), `bcv-tasa-${todayStr()}.txt`);
    await writeFile(file, html, "utf8");
    const saved = await readFile(file, "utf8");
    return extractBcvUsdRate(saved);
  } catch (e) {
    console.error("bcv fetch failed", e);
    return null;
  }
}

export async function getTodayRate(): Promise<{
  date: string;
  rate: number | null;
  source: "bcv" | "manual" | null;
}> {
  const date = todayStr();
  const cached = db
    .select()
    .from(schema.exchangeRates)
    .where(eq(schema.exchangeRates.date, date))
    .get();
  if (cached) return { date, rate: cached.rate, source: cached.source };
  const rate = await fetchBcvRate();
  if (rate === null) return { date, rate: null, source: null };
  db.insert(schema.exchangeRates)
    .values({ id: crypto.randomUUID(), date, rate, source: "bcv", createdAt: Math.floor(Date.now() / 1000) })
    .run();
  return { date, rate, source: "bcv" };
}
