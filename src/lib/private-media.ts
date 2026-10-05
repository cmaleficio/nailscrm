import { ACCEPTED_IMAGE_EXTENSIONS } from "./image-upload";

/**
 * Media que no puede vivir en `/public`.
 *
 * `/public/uploads` se sirve como archivo estático, sin sesión: cualquiera que
 * conozca la URL descarga el archivo. Para las fotos del muro eso es lo
 * quedarse (es el activo de SEO del salón), pero para una **captura de
 * transferencia bancaria** no: ahí van el nombre, el alias y a veces el
 * teléfono de la clienta. Esos archivos salen de `public/` y se sirven desde
 * `/api/media/<kind>/<file>`, que comprueba sesión y propiedad.
 *
 * El nombre lo pone siempre el servidor (`${crypto.randomUUID()}.<ext>`), así
 * que el patrón de `parsePrivateMediaFile` no necesita una lista negra de
 * rutas: acepta un UUID y una extensión de la lista cerrada, y nada más. Un
 * `../../` no entra ni por chance.
 */

export const PRIVATE_UPLOADS_DIRNAME = "private-uploads";

/** Prefijo de las URLs privadas. Distingue una foto sensible de una del muro. */
export const PRIVATE_MEDIA_PREFIX = "/api/media";

export const PRIVATE_MEDIA_KINDS = [
  "receipt",
  "payment",
  "supplier-payment",
  "inventory",
] as const;

export type PrivateMediaKind = (typeof PRIVATE_MEDIA_KINDS)[number];

/**
 * Qué tabla respalda cada kind y quién puede verlo. La tabla se busca por
 * `photo_url`, así que la fila es la que autoriza: el archivo no se sirve
 * porque la URL exista, sino porque una fila lo reclama.
 */
export const PRIVATE_MEDIA_RULES: Record<
  PrivateMediaKind,
  {
    /** Tabla cuyo `photo_url` apunta al archivo. */
    table: "paymentReceipts" | "payments" | "supplierPayments" | "inventoryItems";
    /** Permiso de admin que da acceso total sobre el módulo. */
    permission: string;
    /** Columna con el id de la clienta o del admin dueño, si aplica. */
    ownerColumn: "clientId" | "userId" | null;
    /** Etiqueta para logs y comentarios. */
    label: string;
  }
> = {
  receipt: {
    table: "paymentReceipts",
    permission: "paymentApproval",
    ownerColumn: "clientId",
    label: "captura de pago reportado",
  },
  payment: {
    table: "payments",
    permission: "balances",
    ownerColumn: "userId",
    label: "captura de pago de clienta",
  },
  "supplier-payment": {
    table: "supplierPayments",
    permission: "accountsPayable",
    ownerColumn: null,
    label: "captura de pago a proveedor",
  },
  inventory: {
    table: "inventoryItems",
    permission: "inventory",
    ownerColumn: null,
    label: "foto de producto de inventario",
  },
};

const FILE_RE = new RegExp(
  `^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\\.(${ACCEPTED_IMAGE_EXTENSIONS.join(
    "|"
  )})$`
);

export function isPrivateMediaKind(value: string): value is PrivateMediaKind {
  return (PRIVATE_MEDIA_KINDS as readonly string[]).includes(value);
}

export function privateMediaUrl(kind: PrivateMediaKind, filename: string): string {
  return `${PRIVATE_MEDIA_PREFIX}/${kind}/${filename}`;
}

export function parsePrivateMediaFile(
  file: string
): { filename: string; extension: string } | null {
  const match = FILE_RE.exec(file);
  if (!match) return null;
  return { filename: match[1], extension: match[2] };
}

/**
 * Nombre de archivo de una URL legacy de `/public/uploads`, para el backfill.
 * Acepta solo un nombre de archivo pelado: lo que se guarda es el nombre, y el
 * archivo se mueve dentro de `private-uploads/`, así que cualquier cosa con
 * separadores se descarta.
 */
export function legacyUploadFilename(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  const match = /^\/uploads\/([^/]+)$/.exec(url.trim());
  return match ? match[1] : null;
}
