import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TrackingTags from "./TrackingTags";

/**
 * Regresión: Google decía "No se ha detectado su etiqueta" en el sitio en vivo.
 *
 * La causa era `next/script` con `strategy="afterInteractive"`: en el HTML
 * inicial Next solo emite un `<link rel="preload">` y mete el `<script>` de
 * verdad en el DOM DESPUÉS de la hidratación. La comprobación de Google lee el
 * HTML, no encuentra ninguna etiqueta <script src=googletagmanager> y da la
 * etiqueta por ausente. Estos tests renderizan a HTML estático, que es
 * exactamente lo que ve el verificador.
 */

const GA_SNIPPET = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-YBQKMQVS68"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-YBQKMQVS68');
</script>`;

function render(props: { snippet: string; isEnabled: boolean }): string {
  return renderToStaticMarkup(<TrackingTags {...props} />);
}

describe("TrackingTags (HTML inicial)", () => {
  it("emite el <script src> de gtag.js en el HTML, no solo un preload", () => {
    const html = render({ snippet: GA_SNIPPET, isEnabled: true });

    expect(html).toContain('<script src="https://www.googletagmanager.com/gtag/js?id=G-YBQKMQVS68"');
  });

  it("conserva el atributo async que pide Google", () => {
    const html = render({ snippet: GA_SNIPPET, isEnabled: true });

    expect(html).toMatch(/<script[^>]*googletagmanager\.com\/gtag\/js[^>]*\basync\b/);
  });

  it("emite el bloque inline de gtag con su código legible", () => {
    const html = render({ snippet: GA_SNIPPET, isEnabled: true });

    expect(html).toContain("window.dataLayer = window.dataLayer || []");
    expect(html).toContain("gtag('config', 'G-YBQKMQVS68')");
  });

  it("no escapa el código inline: debe poder ejecutarse tal cual", () => {
    const html = render({ snippet: GA_SNIPPET, isEnabled: true });

    // Si el parser HTML lo escapara, dataLayer y gtag no existirían en runtime.
    expect(html).not.toContain("&lt;script");
    expect(html).not.toContain("&amp;&amp;");
  });

  it("no renderiza nada cuando está desactivado", () => {
    expect(render({ snippet: GA_SNIPPET, isEnabled: false })).toBe("");
  });

  it("no renderiza nada con el snippet vacío", () => {
    expect(render({ snippet: "", isEnabled: true })).toBe("");
    expect(render({ snippet: "   \n ", isEnabled: true })).toBe("");
  });

  it("no renderiza nada si el snippet no trae scripts (pegado truncado)", () => {
    expect(render({ snippet: "solo texto", isEnabled: true })).toBe("");
  });

  it("soporta GTM: script externo con id + el bloque inline que lo inicializa", () => {
    const gtm = `<script>(function(w,d,s,l,i){})(window,document,'script','dataLayer','GTM-XXXX');</script>
<script src="https://www.googletagmanager.com/gtm.js?id=GTM-XXXX"></script>`;
    const html = render({ snippet: gtm, isEnabled: true });

    expect(html).toContain('src="https://www.googletagmanager.com/gtm.js?id=GTM-XXXX"');
    expect(html).toContain("GTM-XXXX");
  });

  it("conserva defer cuando el snippet lo trae", () => {
    const html = render({
      snippet: `<script defer src="https://www.googletagmanager.com/gtm.js?id=GTM-XXXX"></script>`,
      isEnabled: true,
    });

    expect(html).toMatch(/<script[^>]*\bdefer\b/);
  });
});

/**
 * Regresión 2: React 19 AVISA y descarta los <script> inline renderizados dentro
 * de un componente. En react-dom-client, el case "script" de createElement hace
 * `didWarnScriptTags || isScriptDataBlock(newProps) || console.error(...)` y
 * después sustituye el nodo por un <div> vacío:
 *
 *   nextResource.innerHTML = "<script></script>";
 *   nextResource = nextResource.removeChild(nextResource.firstChild);
 *
 * Es decir: el inline sí corría en el HTML del servidor (por eso Google lo
 * detectaba) pero en el cliente React lo reemplaza por un <div> inerte, así que
 * el `gtag('config')` no vuelve a correr y no hay pageview en navegaciones
 * suaves. La única exención es `isScriptDataBlock`: un <script> inline que
 * declara un `type` de JavaScript válido. Por eso el bloque inline DEBE llevar
 * `type="text/javascript"`, que es además lo correcto semánticamente.
 */
describe("TrackingTags (comportamiento en el cliente)", () => {
  it("marca el script inline como bloque de datos JS para no disparar el warning de React", () => {
    const html = render({ snippet: GA_SNIPPET, isEnabled: true });

    // Sin este type, React 19 entra en el case "script" de createElement,
    // registra el console.error y cambia el nodo por un <div> vacío.
    expect(html).toMatch(/<script[^>]*type="text\/javascript"/);
  });

  it("el type del inline es uno de los que isScriptDataBlock acepta", () => {
    const html = render({ snippet: GA_SNIPPET, isEnabled: true });
    const match = html.match(/<script[^>]*type="([^"]+)"/);

    // Lista de isScriptDataBlock en react-dom-client.development.js.
    const accepted = [
      "application/ecmascript",
      "application/javascript",
      "application/x-ecmascript",
      "application/x-javascript",
      "text/ecmascript",
      "text/javascript",
      "text/javascript1.0",
      "text/javascript1.1",
      "text/javascript1.2",
      "text/javascript1.3",
      "text/javascript1.4",
      "text/javascript1.5",
      "text/jscript",
      "text/livescript",
      "text/x-ecmascript",
      "text/x-javascript",
    ];

    expect(match).not.toBeNull();
    expect(accepted).toContain(match![1].toLowerCase());
  });

  it("el script externo NO necesita type (React lo trata como recurso y lo ejecuta)", () => {
    const html = render({ snippet: GA_SNIPPET, isEnabled: true });
    const srcTag = html.match(/<script[^>]*googletagmanager[^>]*>/)![0];

    // Un type no-JS en el externo sí entraría al case "script" y lo descartaría.
    expect(srcTag).not.toMatch(/type=/);
  });

  it("no duplica el type si el admin ya lo puso en el snippet", () => {
    const html = render({
      snippet: `<script type="text/javascript">gtag('config', 'G-1');</script>`,
      isEnabled: true,
    });

    expect(html.match(/type=/g)!.length).toBe(1);
  });
});
