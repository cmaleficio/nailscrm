// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PhotoLightbox, type LightboxPhoto } from "./PhotoLightbox";
import { containSize } from "@/lib/zoom";

/**
 * jsdom no tiene motor de layout (clientWidth siempre 0) ni implementa
 * ResizeObserver, y las imágenes no cargan solas. Este archivo los sustituye por
 * dobles controlados para poder medir el tamaño real que recibe el visor.
 */

const VIEWPORT = { w: 800, h: 600 };
const NATURAL = { w: 1600, h: 1200 };
const DEFAULT_VIEWPORT = { ...VIEWPORT };

type ObserverRecord = { callback: ResizeObserverCallback; targets: Element[] };

let observers: ObserverRecord[] = [];
let root: Root | null = null;
let container: HTMLDivElement | null = null;

class FakeResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    observers.push({ callback, targets: [] });
  }
  observe(target: Element) {
    observers[observers.length - 1].targets.push(target);
  }
  unobserve() {}
  disconnect() {}
}

/** Dispara el callback de cada observer registrado, como si el navegador notificara un resize. */
function flushResizeObservers() {
  for (const record of observers) {
    record.callback([], record as unknown as ResizeObserver);
  }
}

function render(node: React.ReactElement) {
  act(() => {
    root!.render(node);
  });
}

function renderLightbox(photos: LightboxPhoto[]) {
  render(
    <PhotoLightbox
      photos={photos}
      index={0}
      onIndexChange={() => {}}
      onClose={() => {}}
    />,
  );
}

function lightboxImage(): HTMLImageElement {
  const img = container!.querySelector("img");
  if (!img) throw new Error("El visor no renderizó ninguna imagen");
  return img;
}

/** Dispara onLoad con el tamaño natural controlado. */
async function loadImage() {
  const img = lightboxImage();
  await act(async () => {
    img.dispatchEvent(new Event("load"));
  });
}

const PHOTO: LightboxPhoto = { id: "p1", url: "/uploads/foto.jpg", caption: "Foto de prueba" };

beforeEach(() => {
  observers = [];
  Object.assign(VIEWPORT, DEFAULT_VIEWPORT);

  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => VIEWPORT.w,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => VIEWPORT.h,
  });
  Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
    configurable: true,
    get: () => NATURAL.w,
  });
  Object.defineProperty(HTMLImageElement.prototype, "naturalHeight", {
    configurable: true,
    get: () => NATURAL.h,
  });

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  if (root) {
    await act(async () => {
      root!.unmount();
    });
  }
  container?.remove();
  container = null;
  root = null;
  vi.unstubAllGlobals();
});

describe("PhotoLightbox: medición del viewport", () => {
  it("no observa la superficie mientras está cerrado", () => {
    renderLightbox([]);

    expect(observers).toHaveLength(0);
    expect(container!.querySelector('[role="dialog"]')).toBeNull();
  });

  // Regresión del bug "pantalla negra": el efecto que mide el viewport usaba `[]`,
  // corría solo al montar (cuando aún no hay superficie) y abortaba con
  // surfaceRef.current === null, dejando el viewport en 0x0 para siempre.
  it("mide el viewport cuando el visor se abre después de montar", async () => {
    renderLightbox([]);
    expect(observers).toHaveLength(0);

    renderLightbox([PHOTO]);

    expect(observers).toHaveLength(1);
    expect(observers[0].targets).toHaveLength(1);
  });

  it("renderiza la imagen ajustada al viewport, no en 0x0", async () => {
    renderLightbox([]);
    renderLightbox([PHOTO]);
    await act(async () => {
      flushResizeObservers();
    });
    await loadImage();

    const img = lightboxImage();
    const expected = containSize(NATURAL, VIEWPORT);

    expect(img.style.width).toBe(`${expected.w}px`);
    expect(img.style.height).toBe(`${expected.h}px`);
    // La invariante que el usuario veía rota: una imagen de 0x0 es pantalla negra.
    expect(img.style.width).not.toBe("0px");
    expect(img.style.height).not.toBe("0px");
  });

  it("oculta el cartel de Cargando cuando la imagen ya tiene tamaño", async () => {
    renderLightbox([]);
    renderLightbox([PHOTO]);
    await act(async () => {
      flushResizeObservers();
    });

    expect(container!.textContent).toContain("Cargando");

    await loadImage();

    expect(container!.textContent).not.toContain("Cargando");
  });

  it("vuelve a medir al reabrirse después de cerrarse", async () => {
    renderLightbox([]);
    renderLightbox([PHOTO]);
    expect(observers).toHaveLength(1);

    renderLightbox([]);
    expect(container!.querySelector('[role="dialog"]')).toBeNull();

    renderLightbox([PHOTO]);
    expect(observers).toHaveLength(2);
    expect(observers[1].targets).toHaveLength(1);
  });

  it("reacciona a un cambio de tamaño de la ventana", async () => {
    renderLightbox([]);
    renderLightbox([PHOTO]);
    await act(async () => {
      flushResizeObservers();
    });
    await loadImage();

    VIEWPORT.w = 400;
    VIEWPORT.h = 1200;
    await act(async () => {
      flushResizeObservers();
    });

    const expected = containSize(NATURAL, VIEWPORT);
    expect(lightboxImage().style.width).toBe(`${expected.w}px`);
    expect(lightboxImage().style.height).toBe(`${expected.h}px`);
  });
});
