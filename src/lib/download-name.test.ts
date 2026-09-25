import { describe, expect, test } from "vitest";
import {
  fileExtension,
  isSameOriginUrl,
  photoDownloadName,
  slugifyPhotoName,
} from "./download-name";

const ORIGIN = "https://nails.example.com";

describe("isSameOriginUrl", () => {
  test("treats root-relative upload paths as same origin", () => {
    expect(isSameOriginUrl("/uploads/9f2c.jpg", ORIGIN)).toBe(true);
    expect(isSameOriginUrl("/uploads/gallery/9f2c.webp", ORIGIN)).toBe(true);
  });

  test("treats an absolute URL on the same origin as same origin", () => {
    expect(isSameOriginUrl("https://nails.example.com/uploads/9f2c.jpg", ORIGIN)).toBe(true);
  });

  test("rejects other origins, where the download attribute is ignored", () => {
    expect(isSameOriginUrl("https://lh3.googleusercontent.com/a/abc", ORIGIN)).toBe(false);
    expect(isSameOriginUrl("https://picsum.photos/seed/1/200/300", ORIGIN)).toBe(false);
  });

  test("rejects the same host on another port or scheme", () => {
    expect(isSameOriginUrl("https://nails.example.com:8443/uploads/a.jpg", ORIGIN)).toBe(false);
    expect(isSameOriginUrl("http://nails.example.com/uploads/a.jpg", ORIGIN)).toBe(false);
  });

  test("resolves protocol-relative URLs against the current scheme", () => {
    expect(isSameOriginUrl("//nails.example.com/uploads/a.jpg", ORIGIN)).toBe(true);
    expect(isSameOriginUrl("//picsum.photos/a.jpg", ORIGIN)).toBe(false);
  });

  test("treats inline and blob sources as downloadable", () => {
    expect(isSameOriginUrl("data:image/jpeg;base64,AAAA", ORIGIN)).toBe(true);
    expect(isSameOriginUrl("blob:https://nails.example.com/abc", ORIGIN)).toBe(true);
  });

  test("rejects an unparseable URL or origin instead of throwing", () => {
    expect(isSameOriginUrl("http://", ORIGIN)).toBe(false);
    expect(isSameOriginUrl("/uploads/a.jpg", "not-an-origin")).toBe(false);
  });

  test("treats an odd relative path as same origin, since it resolves locally", () => {
    expect(isSameOriginUrl("::::", ORIGIN)).toBe(true);
  });
});

describe("fileExtension", () => {
  test("reads the extension from the path", () => {
    expect(fileExtension("/uploads/9f2c.jpeg")).toBe("jpeg");
    expect(fileExtension("/uploads/gallery/a.png")).toBe("png");
  });

  test("ignores the query string and the hash", () => {
    expect(fileExtension("/uploads/a.jpg?v=2")).toBe("jpg");
    expect(fileExtension("/uploads/a.jpg#foto-1")).toBe("jpg");
    expect(fileExtension("/uploads/a.WEBP")).toBe("webp");
  });

  test("keeps heic so the file keeps its real format", () => {
    expect(fileExtension("/uploads/a.heic")).toBe("heic");
  });

  test("falls back to jpg when there is no usable extension", () => {
    expect(fileExtension("/uploads/9f2c")).toBe("jpg");
    expect(fileExtension("")).toBe("jpg");
    expect(fileExtension("/uploads/a.this-is-not-an-extension")).toBe("jpg");
  });
});

describe("slugifyPhotoName", () => {
  test("lowercases and strips accents", () => {
    expect(slugifyPhotoName("Acrílicas María")).toBe("acrilicas-maria");
  });

  test("collapses punctuation and whitespace into single dashes", () => {
    expect(slugifyPhotoName("Gel  Semipermanente (diseño)")).toBe("gel-semipermanente-diseno");
  });

  test("removes characters that would break the download attribute", () => {
    const slug = slugifyPhotoName("foto/../../etc/passwd");
    expect(slug).not.toContain("/");
    expect(slug).not.toContain(".");
    expect(slug).not.toContain("..");
  });

  test("returns an empty string when there is nothing to keep", () => {
    expect(slugifyPhotoName("   ")).toBe("");
    expect(slugifyPhotoName("///")).toBe("");
  });

  test("truncates very long names so the file stays manageable", () => {
    const slug = slugifyPhotoName("a".repeat(200));
    expect(slug.length).toBeLessThanOrEqual(60);
  });
});

describe("photoDownloadName", () => {
  test("builds a readable name instead of the upload UUID", () => {
    expect(
      photoDownloadName({
        base: "Acrílicas María González",
        date: "2026-09-25",
        url: "/uploads/9f2c8a11-4b7e-4d3a-9c10-2f6b8e5d0a44.jpg",
      })
    ).toBe("acrilicas-maria-gonzalez-2026-09-25.jpg");
  });

  test("omits the date when the caller has none", () => {
    expect(photoDownloadName({ base: "Gel semipermanente", url: "/uploads/a.png" })).toBe(
      "gel-semipermanente.png"
    );
  });

  test("falls back to a generic name when the caption is empty", () => {
    expect(photoDownloadName({ base: "", url: "/uploads/a.jpg" })).toBe("foto.jpg");
    expect(photoDownloadName({ base: null, date: "2026-01-02", url: "/uploads/a.jpg" })).toBe(
      "foto-2026-01-02.jpg"
    );
  });

  test("ignores a date that is not YYYY-MM-DD", () => {
    expect(
      photoDownloadName({ base: "Diseño", date: "25/09/2026", url: "/uploads/a.jpg" })
    ).toBe("diseno.jpg");
    expect(photoDownloadName({ base: "Diseño", date: "2026-9-25", url: "/uploads/a.jpg" })).toBe(
      "diseno.jpg"
    );
  });

  test("produces a safe filename even for a hostile caption", () => {
    const name = photoDownloadName({
      base: '"/><script>alert(1)</script>',
      date: "2026-09-25",
      url: "/uploads/a.jpg",
    });
    expect(name).toBe("script-alert-1-script-2026-09-25.jpg");
    expect(name).not.toContain("/");
    expect(name).not.toContain("<");
  });

  test("keeps the real extension of the stored file", () => {
    expect(photoDownloadName({ base: "Resultado", url: "/uploads/a.webp" })).toBe("resultado.webp");
  });
});
