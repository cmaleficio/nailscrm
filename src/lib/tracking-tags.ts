/**
 * Etiquetas de analítica / tracking.
 *
 * El superadmin pega un snippet cualquiera (GA4, GTM, un pixel, etc.) y lo
 * inyectamos en las páginas públicas. No se guarda ni se renderiza el texto
 * crudo por dos razones:
 *
 *  1. Un `<div dangerouslySetInnerHTML>` NO ejecuta los `<script>` que se
 *     insertan (regla del spec HTML), y meter el snippet dentro de
 *     `next/script` convertiría el texto en un literal inerte. Hay que
 *     descomponerlo en `<script>` reales para que el navegador los corra.
 *  2. Escribir el HTML a mano nos deja decidir qué sale y qué no, en vez de
 *     confiar en un bloque opaco.
 *
 * Todo es función pura y sin I/O: el archivo se testea en entorno node.
 */

/** Tope del snippet. Evita que un pegado accidental guarde megabytes. */
export const MAX_SNIPPET_LENGTH = 20_000;

const MEASUREMENT_ID_RE = /^G-[A-Z0-9]{4,20}$/;

/** Measurement ID de GA4, el formato `G-XXXXXXXXXX`. */
export function isValidMeasurementId(value: unknown): boolean {
  return typeof value === "string" && MEASUREMENT_ID_RE.test(value.trim());
}

/**
 * Monta el snippet oficial de GA4 a partir del Measurement ID. Se usa en el
 * botón "Pegar ejemplo" para que el superadmin no tenga que copiar el código
 * de la consola de Google.
 */
export function buildGoogleAnalyticsSnippet(measurementId: string): string {
  const id = String(measurementId ?? "").trim();
  if (!MEASUREMENT_ID_RE.test(id)) {
    throw new Error("Measurement ID inválido: debe tener el formato G-XXXXXXXXXX");
  }
  return `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', '${id}');
</script>`;
}

export type ParsedTrackingTag =
  | {
      kind: "src";
      src: string;
      isAsync: boolean;
      isDefer: boolean;
      id: string | null;
    }
  | { kind: "inline"; code: string };

type ParsedAttributes = Record<string, string | true>;

// El valor de un atributo puede contener `>` (típico en query strings de los
// tags), así que la comilla se come su contenido antes de buscar el cierre.
const OPEN_TAG_RE = /<script\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
const CLOSE_TAG_RE = /<\/script\s*>/gi;
const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

function parseAttributes(raw: string): ParsedAttributes {
  const attrs: ParsedAttributes = {};
  ATTR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTR_RE.exec(raw)) !== null) {
    const value = match[2] ?? match[3] ?? match[4];
    attrs[match[1].toLowerCase()] = value === undefined ? true : value;
  }
  return attrs;
}

function stringAttr(attrs: ParsedAttributes, name: string): string | null {
  const value = attrs[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readBlock(source: string, bodyStart: number): { body: string; nextIndex: number } {
  CLOSE_TAG_RE.lastIndex = bodyStart;
  const close = CLOSE_TAG_RE.exec(source);
  if (!close) {
    // Script sin cerrar: nos quedamos con lo que haya hasta el final.
    return { body: source.slice(bodyStart), nextIndex: source.length };
  }
  return {
    body: source.slice(bodyStart, close.index),
    nextIndex: close.index + close[0].length,
  };
}

/**
 * Descompone el snippet en los `<script>` que hay que renderizar. El texto que
 * no es script (comentarios, espacios) se descarta, y un script que trae `src`
 * y además código inline produce dos entradas.
 */
export function parseTrackingSnippet(snippet: string): ParsedTrackingTag[] {
  const source = typeof snippet === "string" ? snippet : "";
  if (!source.includes("<script")) return [];

  const tags: ParsedTrackingTag[] = [];
  OPEN_TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = OPEN_TAG_RE.exec(source)) !== null) {
    const rawAttrs = match[1];
    const selfClosing = /\/\s*$/.test(rawAttrs);
    const attrs = parseAttributes(rawAttrs.replace(/\/\s*$/, ""));
    const bodyStart = match.index + match[0].length;

    let body = "";
    if (!selfClosing) {
      const block = readBlock(source, bodyStart);
      body = block.body;
      OPEN_TAG_RE.lastIndex = block.nextIndex;
    }

    const src = stringAttr(attrs, "src");
    if (src) {
      tags.push({
        kind: "src",
        src,
        isAsync: "async" in attrs,
        isDefer: "defer" in attrs,
        id: stringAttr(attrs, "id"),
      });
    }

    const code = body.trim();
    if (code) tags.push({ kind: "inline", code });
  }

  return tags;
}
