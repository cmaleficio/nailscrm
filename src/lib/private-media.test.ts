import { describe, expect, it } from "vitest";
import {
  isPrivateMediaKind,
  legacyUploadFilename,
  parsePrivateMediaFile,
  privateMediaUrl,
  PRIVATE_MEDIA_KINDS,
  PRIVATE_MEDIA_PREFIX,
  PRIVATE_MEDIA_RULES,
} from "./private-media";
import { mimeTypeForExtension } from "./image-upload";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("privateMediaUrl", () => {
  it("deja el archivo fuera de /public/uploads", () => {
    // La razón de existir del módulo: si esto devuelve /uploads, la captura
    // bancaria vuelve a servirse como archivo estático sin sesión.
    const url = privateMediaUrl("receipt", `${UUID}.jpg`);
    expect(url).toBe(`${PRIVATE_MEDIA_PREFIX}/receipt/${UUID}.jpg`);
    expect(url.startsWith("/uploads/")).toBe(false);
  });
});

describe("parsePrivateMediaFile", () => {
  it("acepta un UUID con extensión válida", () => {
    expect(parsePrivateMediaFile(`${UUID}.jpg`)).toEqual({
      filename: UUID,
      extension: "jpg",
    });
    expect(parsePrivateMediaFile(`${UUID}.heic`)?.extension).toBe("heic");
  });

  it("rechaza cualquier intento de salir del directorio", () => {
    for (const evil of [
      `../../../../etc/passwd`,
      `..${"\\"}..${"\\"}dev.db`,
      `../../../dev.db`,
      `/etc/passwd`,
      `${UUID}.jpg/../../secret`,
    ]) {
      expect(parsePrivateMediaFile(evil), `aceptó ${evil}`).toBeNull();
    }
  });

  it("rechaza extensiones fuera de la lista cerrada", () => {
    // SVG es XSS directo y AVIF es el vector del RCE del optimizador de Next.
    for (const ext of ["svg", "avif", "html", "php", "js", "exe"]) {
      expect(parsePrivateMediaFile(`${UUID}.${ext}`), `aceptó .${ext}`).toBeNull();
    }
  });

  it("rechaza nombres que no son UUID", () => {
    // Los nombres legacy (`demo-captura.jpg`) no se sirven: el backfill los
    // renombra a UUID al moverlos, así que ninguno sobrevive en disco.
    expect(parsePrivateMediaFile("demo-captura.jpg")).toBeNull();
    expect(parsePrivateMediaFile("notauuid.jpg")).toBeNull();
  });

  it("no acepta un UUID en mayúsculas", () => {
    // `crypto.randomUUID()` sale en minúsculas; aceptar ambos abriría la puerta
    // a que la misma fila se encontrara con dos URLs distintas.
    expect(parsePrivateMediaFile(`${UUID.toUpperCase()}.jpg`)).toBeNull();
  });
});

describe("isPrivateMediaKind", () => {
  it("acepta los kinds del catálogo", () => {
    for (const kind of PRIVATE_MEDIA_KINDS) {
      expect(isPrivateMediaKind(kind)).toBe(true);
    }
  });

  it("rechaza cualquier otra cosa, incluido un path traversal", () => {
    for (const value of ["", "..", "../../etc", "public", "uploads", "photo", "service"]) {
      expect(isPrivateMediaKind(value)).toBe(false);
    }
  });
});

describe("catálogo de media privada", () => {
  it("cada kind apunta a una tabla y a un permiso de authz existente", () => {
    for (const kind of PRIVATE_MEDIA_KINDS) {
      const rule = PRIVATE_MEDIA_RULES[kind];
      expect(rule.table, `${kind} sin tabla`).toBeTruthy();
      expect(rule.permission, `${kind} sin permiso`).toBeTruthy();
    }
  });

  it("las capturas del cliente son las únicas con dueña", () => {
    // `receipt` y `payment` se ven en "Mis pagos" del portal de clienta, así
    // que tienen que poder resolverse a su dueña sin ser admin.
    expect(PRIVATE_MEDIA_RULES.receipt.ownerColumn).toBe("clientId");
    expect(PRIVATE_MEDIA_RULES.payment.ownerColumn).toBe("userId");
    // La foto de un producto y la captura de un pago a proveedor son datos del
    // salón, no de una clienta.
    expect(PRIVATE_MEDIA_RULES.inventory.ownerColumn).toBeNull();
    expect(PRIVATE_MEDIA_RULES["supplier-payment"].ownerColumn).toBeNull();
  });
});

describe("legacyUploadFilename", () => {
  it("saca el nombre de una URL de /uploads", () => {
    expect(legacyUploadFilename(`/uploads/${UUID}.jpg`)).toBe(`${UUID}.jpg`);
  });

  it("solo acepta un nombre de archivo pelado", () => {
    // Lo que se guarda es el nombre, y el archivo se mueve dentro de
    // `private-uploads/`: cualquier separador es un intento de salir de ahí.
    for (const url of [
      "/uploads/../../dev.db",
      "/uploads/sub/carpeta.jpg",
      "/uploads/",
      "/uploads",
      `https://otro-sitio.com/${UUID}.jpg`,
      null,
      undefined,
    ]) {
      expect(legacyUploadFilename(url as string), `aceptó ${url}`).toBeNull();
    }
  });
});

describe("mimeTypeForExtension", () => {
  it("devuelve el MIME de cada formato aceptado", () => {
    expect(mimeTypeForExtension("jpg")).toBe("image/jpeg");
    expect(mimeTypeForExtension("png")).toBe("image/png");
    expect(mimeTypeForExtension("webp")).toBe("image/webp");
    expect(mimeTypeForExtension("gif")).toBe("image/gif");
    expect(mimeTypeForExtension("heic")).toBe("image/heic");
  });

  it("no inventa un MIME para una extensión desconocida", () => {
    expect(mimeTypeForExtension("svg")).toBeNull();
    expect(mimeTypeForExtension("html")).toBeNull();
  });
});
