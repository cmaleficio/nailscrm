import { db, schema } from "@/db/index";
import { asc, eq, gt } from "drizzle-orm";
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

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Regla de días sin tasa BCV (fin de semana / días bancarios): la tasa aplicable
// para un día sin publicación es la del SIGUIENTE día válido (lunes, o el siguiente
// día hábil tras el viernes con tasa válida; si el lunes es bancario, la del martes…).
export async function refreshTodayRate(): Promise<{
  date: string;
  rate: number | null;
  valueDate: string | null;
  source: "bcv" | null;
  filled: number;
}> {
  const date = todayStr();
  let rate: number | null = null;
  let valueDate: string | null = null;

  const res = await fetchBcvRate();
  if (res !== null) {
    rate = res.rate;
    valueDate = res.valueDate;
  } else {
    const recent = await fetchBcvHistory(0);
    const todayRow = recent.find((r) => r.date === date);
    const nextValid = recent
      .filter((r) => r.date > date)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    rate = todayRow?.rate ?? nextValid?.rate ?? null;
  }

  if (rate === null) {
    return { date, rate: null, valueDate: null, source: null, filled: 0 };
  }

  const now = Math.floor(Date.now() / 1000);
  db.insert(schema.exchangeRates)
    .values({
      id: crypto.randomUUID(),
      date,
      rate,
      source: "bcv",
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: schema.exchangeRates.date,
      set: { rate, source: "bcv", createdAt: now },
    })
    .run();

  // Regla de días sin tasa propia (fin de semana / días bancarios): la tasa aplicable
  // para un día sin publicación es la del SIGUIENTE día válido (lunes, o el siguiente
  // día hábil tras el viernes con tasa válida; si el lunes es bancario, la del martes…).
  // Como "hoy" acaba de quedar con tasa, arrastramos su tasa hacia atrás sobre la
  // franja contigua de días faltantes (fin de semana/hueco inmediatamente anterior),
  // deteniéndonos en la primera fecha ya registrada.
  let filled = 0;
  for (let back = 1; back <= 12; back++) {
    const gap = addDays(date, -back);
    const existing = db
      .select()
      .from(schema.exchangeRates)
      .where(eq(schema.exchangeRates.date, gap))
      .get();
    if (existing) break;
    db.insert(schema.exchangeRates)
      .values({
        id: crypto.randomUUID(),
        date: gap,
        rate,
        source: "bcv",
        createdAt: now,
      })
      .run();
    filled++;
  }

  return { date, rate, valueDate, source: "bcv", filled };
}

const BCV_HISTORY_URL = "https://www.bcv.org.ve/estadisticas/indice-de-inversion";

export type BcvHistoryRow = { date: string; rate: number };

export function extractBcvHistoryLastPage(html: string): number {
  const m = html.match(/class="pager-last"[\s\S]*?href="[^"]*\?page=(\d+)"/i);
  return m ? parseInt(m[1], 10) : 0;
}

export function extractBcvHistory(html: string): BcvHistoryRow[] {
  const out: BcvHistoryRow[] = [];
  const rowRe = /<tr class="[^"]*letra-pequeña[^"]*">([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const cells = m[1];
    const d = cells.match(/content="(\d{4}-\d{2}-\d{2})T/i);
    if (!d) continue;
    const r = cells.match(
      /<td class="views-field views-field-views-conditional"\s*>[\s\S]*?([\d.,]+)[\s\S]*?<\/td>/i
    );
    if (!r) continue;
    const rate = normalizeBcvNumber(r[1]);
    if (rate === null) continue;
    out.push({ date: d[1], rate });
  }
  return out;
}

export async function fetchBcvHistory(maxPages = 60): Promise<BcvHistoryRow[]> {
  const all: BcvHistoryRow[] = [];
  const seen = new Set<string>();
  let lastPage = 0;
  for (let page = 0; page <= maxPages; page++) {
    const url =
      page === 0 ? BCV_HISTORY_URL : `${BCV_HISTORY_URL}?page=${page}`;
    const html = await httpsGetText(url);
    if (html === null) break;
    lastPage = Math.max(lastPage, extractBcvHistoryLastPage(html));
    let added = 0;
    for (const row of extractBcvHistory(html)) {
      if (!seen.has(row.date)) {
        seen.add(row.date);
        all.push(row);
        added++;
      }
    }
    if (added === 0 && page > 0) break;
    if (page >= lastPage) break;
  }
  return all;
}

export async function backfillMissingRates(): Promise<{
  scanned: number;
  inserted: number;
  alreadyPresent: number;
  failed: boolean;
}> {
  const existing = new Set(
    db
      .select({ date: schema.exchangeRates.date })
      .from(schema.exchangeRates)
      .all()
      .map((r) => r.date)
  );
  const history = await fetchBcvHistory();
  if (history.length === 0) {
    return { scanned: 0, inserted: 0, alreadyPresent: 0, failed: true };
  }
  const missing = history.filter((h) => !existing.has(h.date));
  const now = Math.floor(Date.now() / 1000);
  for (let i = 0; i < missing.length; i += 300) {
    db.insert(schema.exchangeRates)
      .values(
        missing.slice(i, i + 300).map((h) => ({
          id: crypto.randomUUID(),
          date: h.date,
          rate: h.rate,
          source: "bcv" as const,
          createdAt: now,
        }))
      )
      .onConflictDoNothing({ target: schema.exchangeRates.date })
      .run();
  }
  return {
    scanned: history.length,
    inserted: missing.length,
    alreadyPresent: history.length - missing.length,
    failed: false,
  };
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
