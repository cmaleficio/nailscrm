/** Extensiones que se conservan tal cual; el resto se fuerza a "jpg". */
const KNOWN_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
  "heic",
  "heif",
  "bmp",
  "tif",
  "tiff",
]);

const MAX_SLUG_LENGTH = 60;

/**
 * El atributo `download` de HTML solo es respetado para URLs del mismo origen.
 * Para fotos servidas por /public/uploads alcanza con que sea relativa; para
 * avatares de Google o el seed de picsum.photos hay que abrir en otra pestaña.
 */
export function isSameOriginUrl(url: string, origin: string): boolean {
  if (url.startsWith("data:") || url.startsWith("blob:")) return true;
  try {
    const base = new URL(origin);
    return new URL(url, base).origin === base.origin;
  } catch {
    return false;
  }
}

/**
 * Extensión real del archivo, sin query ni hash. Se usa `jpg` cuando no hay
 * una extensión reconocible, para que el archivo descargado siga siendo válido.
 */
export function fileExtension(url: string): string {
  const path = url.split(/[?#]/)[0] ?? "";
  const name = path.split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return "jpg";
  const ext = name.slice(dot + 1).toLowerCase();
  return KNOWN_EXTENSIONS.has(ext) ? ext : "jpg";
}

/** Convierte un texto libre en un fragmento de nombre de archivo seguro. */
export function slugifyPhotoName(input: string | null | undefined): string {
  const slug = (input ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
  return slug;
}

/**
 * Nombre de descarga legible en lugar del UUID que genera /api/upload.
 * `date` se espera ya formateado como "YYYY-MM-DD" (lo arma cada pantalla con su
 * propio Intl.DateTimeFormat) para no meter una zona horaria en este módulo.
 */
export function photoDownloadName({
  base,
  date,
  url,
  fallback = "foto",
}: {
  base?: string | null;
  date?: string | null;
  url: string;
  fallback?: string;
}): string {
  const slug = slugifyPhotoName(base) || slugifyPhotoName(fallback) || "foto";
  const stamp = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  const ext = fileExtension(url);
  return stamp ? `${slug}-${stamp}.${ext}` : `${slug}.${ext}`;
}
