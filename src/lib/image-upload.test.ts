import { describe, it, expect } from "vitest";
import {
  detectImageType,
  validateImageUpload,
  MAX_UPLOAD_BYTES,
} from "./image-upload";

function jpegBytes(): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 0x11)]);
}

function pngBytes(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
}

function gifBytes(): Buffer {
  return Buffer.concat([Buffer.from("GIF89a", "latin1"), Buffer.alloc(16, 0x22)]);
}

function webpBytes(): Buffer {
  return Buffer.concat([
    Buffer.from("RIFF", "latin1"),
    Buffer.from([0x1a, 0x00, 0x00, 0x00]),
    Buffer.from("WEBP", "latin1"),
    Buffer.alloc(16, 0x33),
  ]);
}

function heicBytes(brand = "heic"): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(24, 0);
  head.write("ftyp", 4, "latin1");
  const brandBuf = Buffer.from(brand, "latin1");
  return Buffer.concat([head, brandBuf, Buffer.from("mif1", "latin1"), Buffer.alloc(16, 0x44)]);
}

function avifBytes(): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(24, 0);
  head.write("ftyp", 4, "latin1");
  return Buffer.concat([head, Buffer.from("avif", "latin1"), Buffer.from("mif1", "latin1")]);
}

describe("detectImageType", () => {
  it("detecta JPEG y normaliza la extensión a jpg", () => {
    expect(detectImageType(jpegBytes())).toEqual({ ok: true, type: "image/jpeg", extension: "jpg" });
  });

  it("detecta PNG", () => {
    expect(detectImageType(pngBytes())).toEqual({ ok: true, type: "image/png", extension: "png" });
  });

  it("detecta GIF", () => {
    expect(detectImageType(gifBytes())).toEqual({ ok: true, type: "image/gif", extension: "gif" });
  });

  it("detecta WebP exigiendo la marca RIFF y WEBP", () => {
    expect(detectImageType(webpBytes())).toEqual({ ok: true, type: "image/webp", extension: "webp" });
  });

  it("rechaza un RIFF que no sea WEBP", () => {
    const wav = Buffer.concat([
      Buffer.from("RIFF", "latin1"),
      Buffer.from([0x1a, 0x00, 0x00, 0x00]),
      Buffer.from("WAVE", "latin1"),
    ]);
    expect(detectImageType(wav).ok).toBe(false);
  });

  it("detecta HEIC en todas sus marcas de brand", () => {
    for (const brand of ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]) {
      expect(detectImageType(heicBytes(brand))).toEqual({
        ok: true,
        type: "image/heic",
        extension: "heic",
      });
    }
  });

  it("rechaza AVIF aunque sea un ISO BMFF válido", () => {
    const result = detectImageType(avifBytes());
    expect(result.ok).toBe(false);
  });

  it("rechaza HTML aunque el nombre diga .jpg", () => {
    const html = Buffer.from("<!DOCTYPE html><script>alert(1)</script>", "latin1");
    expect(detectImageType(html).ok).toBe(false);
  });

  it("rechaza SVG", () => {
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')).ok).toBe(false);
  });

  it("rechaza PDF", () => {
    expect(detectImageType(Buffer.from("%PDF-1.7\n...")).ok).toBe(false);
  });

  it("rechaza un buffer vacío", () => {
    const result = detectImageType(Buffer.alloc(0));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/vacío/i);
  });

  it("rechaza un buffer demasiado corto para sniffear", () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8])).ok).toBe(false);
  });

  it("rechaza un ISO BMFF sin la caja ftyp", () => {
    const bogus = Buffer.concat([Buffer.alloc(4, 0x00), Buffer.from("junkmif1", "latin1")]);
    expect(detectImageType(bogus).ok).toBe(false);
  });
});

describe("validateImageUpload", () => {
  it("acepta una imagen válida y devuelve la extensión del servidor", () => {
    const result = validateImageUpload({ size: jpegBytes().length }, jpegBytes());
    expect(result).toEqual({ ok: true, extension: "jpg" });
  });

  it("rechaza archivos sobre el límite de tamaño", () => {
    const result = validateImageUpload({ size: MAX_UPLOAD_BYTES + 1 }, jpegBytes());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/25 MB/);
  });

  it("rechaza contenido que no es imagen aunque el tamaño sea válido", () => {
    const payload = Buffer.from("<script>alert(1)</script>", "latin1");
    const result = validateImageUpload({ size: payload.length }, payload);
    expect(result.ok).toBe(false);
  });

  it("no acepta un tamaño negativo o cero con buffer vacío", () => {
    const result = validateImageUpload({ size: 0 }, Buffer.alloc(0));
    expect(result.ok).toBe(false);
  });
});
