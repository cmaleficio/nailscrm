import { parseTrackingSnippet, type ParsedTrackingTag } from "@/lib/tracking-tags";

/**
 * Inyecta el snippet de etiquetas de analítica en el <head> de las páginas
 * públicas.
 *
 * Se monta SOLO en el layout raíz (`src/app/layout.tsx`), dentro de su `<head>`,
 * y no en los layouts (public)/(client). Dos razones:
 *
 * 1. El layout raíz es el único que puede escribir en <head>. Un layout anidado
 *    renderiza dentro de <body>, y React 19 solo sube a <head> los
 *    `<script async src>`; los inline nunca se mueven. Es decir, desde los
 *    layouts anidados el externo acababa en <head> y el `gtag('config')` inline
 *    en <body>, que es exactamente lo que Google pide evitar.
 * 2. El gating lo decide `src/proxy.ts` con el header `x-tracking-scope`, así que
 *    las visitas al dashboard no se ensucian en las métricas de GA y las
 *    etiquetas de terceros nunca se llevan nombres de clientas ni saldos.
 *
 * Renderiza `<script>` NATIVOS de React y no `next/script` a propósito. Con
 * `next/script` + `strategy="afterInteractive"` Next solo emite un
 * `<link rel="preload">` en el HTML inicial y mete el script de verdad en el
 * DOM después de la hidratación: la comprobación de Google lee el HTML, no
 * encuentra la etiqueta y la da por ausente.
 *
 * Es un Server Component: el HTML se genera en el servidor, así que el
 * `dangerouslySetInnerHTML` de abajo solo llega al navegador cuando el
 * superadmin guardó ese código. No hay endpoint público que lo exponga.
 */
export default function TrackingTags({ snippet, isEnabled }: { snippet: string; isEnabled: boolean }) {
  if (!isEnabled || !snippet.trim()) return null;

  const tags = parseTrackingSnippet(snippet);
  if (tags.length === 0) return null;

  return <>{tags.map((tag, i) => renderTag(tag, i))}</>;
}

function renderTag(tag: ParsedTrackingTag, i: number) {
  if (tag.kind === "src") {
    // Sin `type`: React trata un <script src> como recurso, lo sube a <head> y
    // lo ejecuta. Ponerle un type que no sea JS lo metería en el case "script"
    // de createElement y React lo descartaría.
    return (
      <script
        key={`tag-src-${i}`}
        id={tag.id ?? undefined}
        src={tag.src}
        async={tag.isAsync}
        defer={tag.isDefer}
      />
    );
  }

  // El type NO es decorativo: React 19 descarta los <script> inline que se
  // renderizan dentro de un componente (registra el warning y cambia el nodo por
  // un <div> vacío), salvo que el script se declare como bloque de datos con un
  // type de JavaScript válido (`isScriptDataBlock` en react-dom-client). Con
  // esto el gtag('config') sí corre también tras una navegación suave.
  return (
    <script
      key={`tag-inline-${i}`}
      type="text/javascript"
      dangerouslySetInnerHTML={{ __html: tag.code }}
    />
  );
}
