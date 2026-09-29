import { describe, expect, it } from "vitest";
import {
  buildGoogleAnalyticsSnippet,
  isValidMeasurementId,
  parseTrackingSnippet,
  MAX_SNIPPET_LENGTH,
} from "./tracking-tags";

// El snippet exacto que entrega Google Analytics 4 en "Instalar manualmente".
const GA_SNIPPET = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-YBQKMQVS68"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-YBQKMQVS68');
</script>`;

describe("parseTrackingSnippet", () => {
  it("devuelve vacío para entradas sin scripts", () => {
    expect(parseTrackingSnippet("")).toEqual([]);
    expect(parseTrackingSnippet("   \n\t  ")).toEqual([]);
    expect(parseTrackingSnippet(null as unknown as string)).toEqual([]);
    expect(parseTrackingSnippet(undefined as unknown as string)).toEqual([]);
  });

  it("separa el script externo del bloque inline del snippet de GA4", () => {
    const tags = parseTrackingSnippet(GA_SNIPPET);

    expect(tags).toHaveLength(2);
    expect(tags[0]).toEqual({
      kind: "src",
      src: "https://www.googletagmanager.com/gtag/js?id=G-YBQKMQVS68",
      isAsync: true,
      isDefer: false,
      id: null,
    });
    expect(tags[1].kind).toBe("inline");
  });

  it("conserva el código inline sin alterar comparadores ni comillas", () => {
    const code = "if (a < b && c > d) { gtag('event', 'purchase', { value: 1.5 }); }";
    const tags = parseTrackingSnippet(`<script>${code}</script>`);

    expect(tags).toEqual([{ kind: "inline", code }]);
  });

  it("descarta el comentario HTML y el texto alrededor de los scripts", () => {
    const tags = parseTrackingSnippet(
      `<!-- Google tag (gtag.js) -->\n  <script src="/a.js"></script>\n<!-- fin -->\n`
    );

    expect(tags).toEqual([
      { kind: "src", src: "/a.js", isAsync: false, isDefer: false, id: null },
    ]);
  });

  it("acepta atributos con comillas simples y sin src produce inline", () => {
    const tags = parseTrackingSnippet(
      `<script type='text/javascript' data-layer='x'>gtag('js');</script>`
    );

    expect(tags).toEqual([{ kind: "inline", code: "gtag('js');" }]);
  });

  it("soporta el script auto-cerrado", () => {
    const tags = parseTrackingSnippet(`<script async src="/b.js" />`);

    expect(tags).toEqual([
      { kind: "src", src: "/b.js", isAsync: true, isDefer: false, id: null },
    ]);
  });

  it("lee defer e id", () => {
    const tags = parseTrackingSnippet(
      `<script defer id="gtm" src="https://www.googletagmanager.com/gtm.js"></script>`
    );

    expect(tags[0]).toEqual({
      kind: "src",
      src: "https://www.googletagmanager.com/gtm.js",
      isAsync: false,
      isDefer: true,
      id: "gtm",
    });
  });

  it("tolera un > dentro de un valor de atributo entrecomillado", () => {
    const tags = parseTrackingSnippet(`<script async src="/c.js" data-layer="a>b"></script>`);

    expect(tags[0]).toMatchObject({ kind: "src", src: "/c.js", isAsync: true });
  });

  it("emite ambos cuando un script trae src y además código inline", () => {
    const tags = parseTrackingSnippet(`<script src="/d.js">gtag('init');</script>`);

    expect(tags).toEqual([
      { kind: "src", src: "/d.js", isAsync: false, isDefer: false, id: null },
      { kind: "inline", code: "gtag('init');" },
    ]);
  });

  it("cierra el script al primer </script> y sigue parseando los siguientes", () => {
    const tags = parseTrackingSnippet(
      `<script>var a = 1;</script><div>texto</div><script>var b = 2;</script>`
    );

    expect(tags).toEqual([
      { kind: "inline", code: "var a = 1;" },
      { kind: "inline", code: "var b = 2;" },
    ]);
  });

  it("no rompe con un script sin cerrar", () => {
    const tags = parseTrackingSnippet(`<script>gtag('config', 'G-1');`);

    expect(tags).toEqual([{ kind: "inline", code: "gtag('config', 'G-1');" }]);
  });

  it("ignora etiquetas que no son script", () => {
    const tags = parseTrackingSnippet(
      `<noscript><img src="/pixel.gif" /></noscript><iframe src="/x"></iframe>`
    );

    expect(tags).toEqual([]);
  });

  it("descarta scripts con src vacío", () => {
    expect(parseTrackingSnippet(`<script src=""></script>`)).toEqual([]);
  });

  it("no es alterado por un snippet muy largo", () => {
    const big = `<script src="/a.js"></script>${"// filler\n".repeat(500)}`;
    expect(parseTrackingSnippet(big)).toHaveLength(1);
  });
});

describe("isValidMeasurementId", () => {
  it("acepta un ID con el formato de GA4", () => {
    expect(isValidMeasurementId("G-YBQKMQVS68")).toBe(true);
    expect(isValidMeasurementId("G-ABC123")).toBe(true);
  });

  it("rechaza formatos inválidos", () => {
    expect(isValidMeasurementId("")).toBe(false);
    expect(isValidMeasurementId("YBQKMQVS68")).toBe(false);
    expect(isValidMeasurementId("UA-12345-1")).toBe(false);
    expect(isValidMeasurementId("G-abc")).toBe(false);
    expect(isValidMeasurementId("G-AB!CD")).toBe(false);
    expect(isValidMeasurementId("G-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345")).toBe(false);
  });
});

describe("buildGoogleAnalyticsSnippet", () => {
  it("genera un snippet que el parser puede releer", () => {
    const snippet = buildGoogleAnalyticsSnippet("G-YBQKMQVS68");

    expect(snippet).toBe(GA_SNIPPET);
    expect(parseTrackingSnippet(snippet)).toHaveLength(2);
  });

  it("lanza si el ID no tiene el formato de GA4", () => {
    expect(() => buildGoogleAnalyticsSnippet("basura")).toThrow();
  });
});

describe("MAX_SNIPPET_LENGTH", () => {
  it("es un tope generoso pero finito", () => {
    expect(MAX_SNIPPET_LENGTH).toBeGreaterThan(2000);
    expect(MAX_SNIPPET_LENGTH).toBeLessThanOrEqual(100_000);
  });
});
