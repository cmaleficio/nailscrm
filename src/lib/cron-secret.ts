import { createHash, timingSafeEqual } from "node:crypto";

/**
 * El secreto del cron se acepta **solo** por el header `Authorization: Bearer`.
 *
 * Antes estos dos endpoints también admitían `?secret=` en el query string, y
 * una URL con query string se fuga por tres sitios que nadie controla: los
 * access logs del túnel, el `Referer` que el navegador envía al navegar y el
 * historial. Un header no se registra por defecto, así que es el único sitio
 * razonable para un secreto de esta clase.
 *
 * La comparación pasa por SHA-256 porque `timingSafeEqual` exige buffers del
 * mismo tamaño, y los dos lados pueden medir distinto.
 */
export function isValidCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET || "";
  if (!expected) return false;
  const header = request.headers.get("authorization");
  const provided = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
