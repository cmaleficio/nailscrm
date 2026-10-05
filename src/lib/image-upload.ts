/**
 * Validación de imágenes subidas.
 *
 * Los archivos de /public/uploads se sirven en el MISMO origen que la app, así que
 * un archivo con contenido HTML o SVG es XSS con acceso a la cookie de sesión. Por eso
 * nunca nos fiamos de la extensión que manda el cliente: detectamos el contenedor real
 * por sus magic bytes y guardamos la extensión canónica que decide el servidor.
 */

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const ACCEPTED_IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "heic",
] as const;

export type AcceptedImageExtension = (typeof ACCEPTED_IMAGE_EXTENSIONS)[number];

function startsWith(buffer: Buffer, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (buffer[offset + i] !== bytes[i]) return false;
  }
  return true;
}

function ascii(buffer: Buffer, offset: number, length: number): string {
  return buffer.subarray(offset, offset + length).toString("latin1");
}

function isIsoBmff(buffer: Buffer, brands: string[]): boolean {
  // ISO base media (HEIC y AVIF): tamaño 4 bytes + "ftyp" + marca del formato.
  if (!startsWith(buffer, asciiBytes("ftyp"), 4)) return false;
  const brand = ascii(buffer, 8, 4);
  return brands.includes(brand);
}

function asciiBytes(value: string): number[] {
  return Array.from(value, (char) => char.charCodeAt(0));
}

export type DetectImageResult =
  | { ok: true; type: string; extension: AcceptedImageExtension }
  | { ok: false; reason: string };

/**
 * Detecta el tipo real de una imagen a partir de sus primeros bytes.
 * AVIF y SVG quedan fuera a propósito: AVIF es el vector del RCE de la API de
 * optimización de imágenes de Next (GHSA-2xp9-vwfh-vxw4) y SVG es XSS directo.
 */
export function detectImageType(buffer: Buffer): DetectImageResult {
  if (buffer.length === 0) {
    return { ok: false, reason: "El archivo está vacío" };
  }

  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return { ok: true, type: "image/jpeg", extension: "jpg" };
  }

  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { ok: true, type: "image/png", extension: "png" };
  }

  if (startsWith(buffer, asciiBytes("GIF8"))) {
    return { ok: true, type: "image/gif", extension: "gif" };
  }

  if (startsWith(buffer, asciiBytes("RIFF")) && ascii(buffer, 8, 4) === "WEBP") {
    return { ok: true, type: "image/webp", extension: "webp" };
  }

  if (isIsoBmff(buffer, ["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"])) {
    return { ok: true, type: "image/heic", extension: "heic" };
  }

  return {
    ok: false,
    reason:
      "El archivo no es una imagen válida (formatos aceptados: JPG, PNG, WebP, GIF y HEIC)",
  };
}

/**
 * MIME a partir de la extensión canónica. Sirve para responder las media
 * privada desde `/api/media`: como el archivo se sirve desde un route handler
 * y no desde el servidor de estáticos, hay que poner el `Content-Type` a mano,
 * y ponerlo con `nosniff` es lo que impide que el navegador lo interprete como
 * otra cosa.
 */
const MIME_BY_EXTENSION: Record<AcceptedImageExtension, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
};

export function mimeTypeForExtension(extension: string): string | null {
  return MIME_BY_EXTENSION[extension as AcceptedImageExtension] ?? null;
}

/**
 * Valida tamaño y contenido, y devuelve la extensión con la que debe guardarse.
 * La extensión devuelta la decide el servidor a partir de los magic bytes, nunca
 * a partir del nombre que envió el cliente.
 */
export function validateImageUpload(
  file: { size: number },
  buffer: Buffer,
): { ok: true; extension: AcceptedImageExtension } | { ok: false; reason: string } {
  if (file.size > MAX_UPLOAD_BYTES) {
    const limitMb = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
    return { ok: false, reason: `La imagen supera el límite de ${limitMb} MB` };
  }

  const detected = detectImageType(buffer);
  if (!detected.ok) {
    return detected;
  }

  return { ok: true, extension: detected.extension };
}
