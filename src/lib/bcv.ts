import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import https from "node:https";
import { todayStr } from "@/lib/time";

export function normalizeBcvNumber(s: string): number | null {
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function extractBcvUsdRate(html: string): number | null {
  const m = html.match(
    /id="dolar"[\s\S]*?<strong class="strong-tb">([\d.,]+)<\/strong>/i
  );
  if (!m) return null;
  return normalizeBcvNumber(m[1]);
}

export function extractBcvValueDate(html: string): string | null {
  const m = html.match(
    /date-display-single[^>]*content="(\d{4}-\d{2}-\d{2})[^"]*"/i
  );
  return m ? m[1] : null;
}

function httpsGetText(url: string, timeoutMs = 10000): Promise<string | null> {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      {
        rejectUnauthorized: false,
        headers: {
          "Accept-Language": "es",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          resolve(httpsGetText(new URL(res.headers.location, url).toString(), timeoutMs));
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          resolve(null);
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      }
    );
    req.on("error", () => resolve(null));
    const timer = setTimeout(() => req.destroy(), timeoutMs);
    req.on("close", () => clearTimeout(timer));
  });
}

export async function fetchBcvRate(): Promise<{
  rate: number;
  valueDate: string | null;
} | null> {
  const html = await httpsGetText("https://www.bcv.org.ve/");
  if (html === null) {
    console.error("bcv fetch failed");
    return null;
  }
  const file = path.join(os.tmpdir(), `bcv-tasa-${todayStr()}.txt`);
  try {
    await writeFile(file, html, "utf8");
  } catch (e) {
    console.error("bcv write failed", e);
  }
  const saved = await readFile(file, "utf8");
  const rate = extractBcvUsdRate(saved);
  if (rate === null) return null;
  return { rate, valueDate: extractBcvValueDate(saved) };
}

export async function refreshTodayRate(): Promise<{
  date: string;
  rate: number | null;
  valueDate: string | null;
  source: "bcv" | null;
}> {
  const date = todayStr();
  const res = await fetchBcvRate();
  if (res === null) return { date, rate: null, valueDate: null, source: null };
  db.insert(schema.exchangeRates)
    .values({
      id: crypto.randomUUID(),
      date,
      rate: res.rate,
      source: "bcv",
      createdAt: Math.floor(Date.now() / 1000),
    })
    .onConflictDoUpdate({
      target: schema.exchangeRates.date,
      set: {
        rate: res.rate,
        source: "bcv",
        createdAt: Math.floor(Date.now() / 1000),
      },
    })
    .run();
  return { date, rate: res.rate, valueDate: res.valueDate, source: "bcv" };
}

export async function getRateByDate(dateStr: string): Promise<{
  date: string;
  rate: number | null;
  source: "bcv" | "manual" | null;
}> {
  const cached = db
    .select()
    .from(schema.exchangeRates)
    .where(eq(schema.exchangeRates.date, dateStr))
    .get();
  if (cached) return { date: dateStr, rate: cached.rate, source: cached.source };
  return { date: dateStr, rate: null, source: null };
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
  const refreshed = await refreshTodayRate();
  return {
    date: refreshed.date,
    rate: refreshed.rate,
    source: refreshed.source,
  };
}
