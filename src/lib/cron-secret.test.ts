import { afterEach, describe, expect, it } from "vitest";
import { isValidCronSecret } from "./cron-secret";

const ORIGINAL = process.env.CRON_SECRET;

function req(init: { headers?: Record<string, string>; url?: string } = {}): Request {
  return new Request(init.url ?? "http://localhost:3001/api/exchange-rate/refresh", {
    headers: init.headers,
  });
}

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL;
});

describe("isValidCronSecret", () => {
  it("acepta el secreto correcto en el header Bearer", () => {
    process.env.CRON_SECRET = "s3cr3t";
    expect(isValidCronSecret(req({ headers: { authorization: "Bearer s3cr3t" } }))).toBe(true);
  });

  it("rechaza un secreto incorrecto", () => {
    process.env.CRON_SECRET = "s3cr3t";
    expect(isValidCronSecret(req({ headers: { authorization: "Bearer otro" } }))).toBe(false);
  });

  it("rechaza prefijos distintos de Bearer", () => {
    process.env.CRON_SECRET = "s3cr3t";
    expect(isValidCronSecret(req({ headers: { authorization: "s3cr3t" } }))).toBe(false);
    expect(isValidCronSecret(req({ headers: { authorization: "bearer s3cr3t" } }))).toBe(false);
  });

  it("rechaza una petición sin header", () => {
    process.env.CRON_SECRET = "s3cr3t";
    expect(isValidCronSecret(req())).toBe(false);
  });

  it("falla cerrado si CRON_SECRET no está configurado", () => {
    // Sin esta comprobación, `expected` sería "" y una petición con el header
    // vacío compararía "" contra "" y devolvería true.
    delete process.env.CRON_SECRET;
    expect(isValidCronSecret(req({ headers: { authorization: "Bearer " } }))).toBe(false);
    expect(isValidCronSecret(req())).toBe(false);
  });

  it("ya no acepta el secreto por query string", () => {
    // El query string se filtra a los access logs del túnel, al `Referer` y al
    // historial del navegador, así que se retiró como vía de autenticación.
    process.env.CRON_SECRET = "s3cr3t";
    expect(
      isValidCronSecret(req({ url: "http://localhost:3001/api/exchange-rate/refresh?secret=s3cr3t" }))
    ).toBe(false);
  });
});
