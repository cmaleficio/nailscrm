import { foldSearchText } from "./production-photos";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";

export type MatchDb = BetterSQLite3Database<typeof schema>;

/**
 * Puntuación mínima para que una clienta aparezca como candidata
 * a "¿ya eres cliente?". Es un prompt (la clienta elige), no una
 * unión automática, así que conviene recordar antes que filtrar de
 * más: 0.75 deja entrar a quien comparte nombre + inicial de apellido.
 */
export const NAME_MATCH_THRESHOLD = 0.75;
export const MAX_NAME_CANDIDATES = 5;

export interface NameCandidate {
  id: string;
  name: string;
  phone: string | null;
  totalVisits: number | null;
  score: number;
}

/**
 * Normaliza un nombre para comparar: pliega tildes (reusa el
 * plegado del buscador de producción), baja a minúsculas, quita
 * signos de puntuación y colapsa espacios. "Ana  Martínez, Sra."
 * y "ana martinez" quedan idénticos.
 */
export function normalizeName(name: string): string {
  return foldSearchText(name)
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = new Array<number>(b.length + 1);
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

/**
 * Similitud de dos nombres en [0, 1]:
 * - 1.0  nombres normalizados iguales
 * - 0.9  mismos tokens en distinto orden ("Ana García Martínez" vs "Ana Martínez García")
 * - 0.85 un nombre contiene todos los tokens del otro ("Ana Martínez" vs "Ana Martínez García")
 * - ≥0.8 typo: distancia de edición ≤ 20% de la longitud mayor
 * - 0.75 mismo primer nombre + misma inicial de apellido
 */
export function nameSimilarity(rawA: string, rawB: string): number {
  const a = normalizeName(rawA);
  const b = normalizeName(rawB);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const aTokens = a.split(" ");
  const bTokens = b.split(" ");
  const multiToken = aTokens.length > 1 && bTokens.length > 1;

  if (multiToken) {
    const aSorted = [...aTokens].sort().join(" ");
    const bSorted = [...bTokens].sort().join(" ");
    if (aSorted === bSorted) return 0.9;

    const [shorter, longer] =
      aTokens.length <= bTokens.length
        ? [new Set(aTokens), new Set(bTokens)]
        : [new Set(bTokens), new Set(aTokens)];
    const isSubset = [...shorter].every((t) => longer.has(t));
    if (isSubset) return 0.85;
  }

  const maxLen = Math.max(a.length, b.length);
  const typoScore = 1 - levenshtein(a, b) / maxLen;

  const aFirst = aTokens[0];
  const bFirst = bTokens[0];
  const aLast = aTokens[aTokens.length - 1];
  const bLast = bTokens[bTokens.length - 1];
  const initialScore =
    multiToken && aFirst === bFirst && aLast[0] === bLast[0] ? 0.75 : 0;

  return Math.max(typoScore, initialScore);
}

/**
 * Busca clientas con nombre similar a `name`. Escanea las clientas
 * en memoria: un salón tiene de cientos a pocos miles de clientes y
 * SQLite ya trae la fila completa, así que el costo es pequeño y
 * evita una query LIKE que no vería typos.
 */
export function findSimilarClients(
  db: MatchDb,
  name: string,
  opts: {
    excludeId?: string;
    excludeEmail?: string;
    limit?: number;
    minScore?: number;
  } = {}
): NameCandidate[] {
  if (!normalizeName(name)) return [];
  const limit = opts.limit ?? MAX_NAME_CANDIDATES;
  const minScore = opts.minScore ?? NAME_MATCH_THRESHOLD;

  const rows = db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      phone: schema.users.phone,
      totalVisits: schema.users.totalVisits,
      email: schema.users.email,
    })
    .from(schema.users)
    .where(eq(schema.users.role, "client"))
    .all();

  const excludeEmail = opts.excludeEmail?.toLowerCase();
  const candidates: NameCandidate[] = [];
  for (const row of rows) {
    if (opts.excludeId && row.id === opts.excludeId) continue;
    if (excludeEmail && row.email.toLowerCase() === excludeEmail) continue;
    const score = nameSimilarity(name, row.name);
    if (score >= minScore) {
      candidates.push({
        id: row.id,
        name: row.name,
        phone: row.phone,
        totalVisits: row.totalVisits,
        score,
      });
    }
  }
  candidates.sort((x, y) => y.score - x.score);
  return candidates.slice(0, limit);
}

/**
 * Teléfono enmascarado para mostrar la candidata sin exponer el
 * número completo de otra clienta: solo los últimos 4 dígitos.
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `****${digits.slice(-4)}`;
}
