import { describe, expect, test } from "vitest";
import {
  MAX_SCALE,
  MIN_SCALE,
  TAP_ZOOM_SCALE,
  type ZoomTransform,
  clampPan,
  clampScale,
  containOffset,
  containSize,
  distance,
  midpoint,
  tapZoomScale,
  transformAtPoint,
  zoomFactor,
} from "./zoom";

/**
 * El visor dibuja la foto ya ajustada al viewport ("laid out"): el componente
 * calcula `laidOut = containSize(natural, viewport)` una sola vez y a partir de
 * ahí trabaja siempre con ese tamaño, no con el natural de la imagen.
 */
const VIEWPORT = { w: 800, h: 800 };
const LAID_OUT = containSize({ w: 4000, h: 3000 }, VIEWPORT);
const OFFSET = containOffset(LAID_OUT, VIEWPORT);

describe("clampScale", () => {
  test("keeps a scale inside the supported range", () => {
    expect(clampScale(0.4)).toBe(MIN_SCALE);
    expect(clampScale(1.6)).toBe(1.6);
    expect(clampScale(12)).toBe(MAX_SCALE);
  });

  test("falls back to the nearest bound for non-finite input so a broken gesture never blanks the image", () => {
    expect(clampScale(Number.NaN)).toBe(MIN_SCALE);
    expect(clampScale(Number.POSITIVE_INFINITY)).toBe(MAX_SCALE);
    expect(clampScale(Number.NEGATIVE_INFINITY)).toBe(MIN_SCALE);
  });
});

describe("containSize", () => {
  test("scales down to fit both sides of the viewport", () => {
    expect(containSize({ w: 4000, h: 3000 }, { w: 800, h: 800 })).toEqual({ w: 800, h: 600 });
  });

  test("scales up when the photo is smaller than the viewport", () => {
    expect(containSize({ w: 200, h: 100 }, { w: 800, h: 800 })).toEqual({ w: 800, h: 400 });
  });

  test("keeps the natural size when the aspect ratio already matches", () => {
    expect(containSize({ w: 1200, h: 800 }, { w: 1200, h: 800 })).toEqual({ w: 1200, h: 800 });
  });

  test("returns zero instead of dividing by zero on degenerate sizes", () => {
    expect(containSize({ w: 4000, h: 3000 }, { w: 0, h: 0 })).toEqual({ w: 0, h: 0 });
    expect(containSize({ w: 0, h: 0 }, { w: 800, h: 800 })).toEqual({ w: 0, h: 0 });
  });
});

describe("containOffset", () => {
  test("centers the laid out photo inside the viewport", () => {
    expect(OFFSET).toEqual({ x: 0, y: 100 });
  });

  test("is the origin for an untranslated, unzoomed photo", () => {
    expect({ x: OFFSET.x, y: OFFSET.y }).toEqual({ x: 0, y: 100 });
    expect(OFFSET.y + LAID_OUT.h).toBeLessThanOrEqual(VIEWPORT.h);
  });
});

describe("distance and midpoint", () => {
  test("measures the spread between two pointers", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  test("averages two pointers for pinch panning", () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 });
  });
});

describe("zoomFactor", () => {
  test("is the ratio of the new spread over the old one", () => {
    expect(zoomFactor(80, 40)).toBe(2);
    expect(zoomFactor(40, 80)).toBe(0.5);
  });

  test("falls back to 1 when the previous spread is zero", () => {
    expect(zoomFactor(100, 0)).toBe(1);
  });
});

describe("tapZoomScale", () => {
  test("alternates between fit and a close-up", () => {
    expect(tapZoomScale(1)).toBe(TAP_ZOOM_SCALE);
    expect(tapZoomScale(2)).toBe(1);
    expect(tapZoomScale(TAP_ZOOM_SCALE)).toBe(1);
  });
});

describe("clampPan", () => {
  test("snaps back to the origin at fit scale, no matter how far you dragged", () => {
    expect(clampPan(LAID_OUT, VIEWPORT, OFFSET, 1, { x: 120, y: -80 })).toEqual({ x: 0, y: 0 });
  });

  test("prevents dragging the photo away from the viewport when zoomed", () => {
    // scaled box is 1600x1200 inside an 800x800 viewport
    expect(clampPan(LAID_OUT, VIEWPORT, OFFSET, 2, { x: 99999, y: 99999 })).toEqual({ x: 0, y: -100 });
    expect(clampPan(LAID_OUT, VIEWPORT, OFFSET, 2, { x: -99999, y: -99999 })).toEqual({
      x: -800,
      y: -500,
    });
  });

  test("recenters on the axis that is smaller than the viewport when zoomed", () => {
    // at 1.5x the box is 1200x900: wider than the viewport, still shorter than it
    const pan = clampPan(LAID_OUT, VIEWPORT, OFFSET, 1.5, { x: 99999, y: 99999 });
    expect(pan.x).toBe(0);
    expect(pan.y).toBe(-100);
  });

  test("leaves a valid pan untouched", () => {
    expect(clampPan(LAID_OUT, VIEWPORT, OFFSET, 2, { x: -400, y: -200 })).toEqual({
      x: -400,
      y: -200,
    });
  });
});

describe("transformAtPoint", () => {
  /** Where a content point lands on screen for a given transform. */
  const onScreen = (p: { x: number; y: number }, transform: ZoomTransform) => ({
    x: OFFSET.x + p.x * transform.scale + transform.tx,
    y: OFFSET.y + p.y * transform.scale + transform.ty,
  });

  test("keeps the content point under the cursor pinned while zooming in", () => {
    const cursor = { x: 400, y: 400 };
    const next = transformAtPoint({ scale: 1, tx: 0, ty: 0 }, LAID_OUT, VIEWPORT, cursor, 3);
    const pinned = onScreen({ x: 400, y: 300 }, next);

    expect(pinned.x).toBeCloseTo(cursor.x, 6);
    expect(pinned.y).toBeCloseTo(cursor.y, 6);
  });

  test("keeps the content point pinned while zooming out back to fit", () => {
    const cursor = { x: 120, y: 300 };
    const zoomed = transformAtPoint({ scale: 1, tx: 0, ty: 0 }, LAID_OUT, VIEWPORT, cursor, 4);
    const back = transformAtPoint(zoomed, LAID_OUT, VIEWPORT, cursor, 0.25);
    const restored = onScreen({ x: 120, y: 200 }, back);

    expect(restored.x).toBeCloseTo(cursor.x, 6);
    expect(restored.y).toBeCloseTo(cursor.y, 6);
    expect(back.scale).toBeCloseTo(1, 6);
  });

  test("clamps to the visible edge when the cursor lands on the background", () => {
    // y=90 is above the photo, which starts at y=100
    const cursor = { x: 120, y: 90 };
    const next = transformAtPoint({ scale: 1, tx: 0, ty: 0 }, LAID_OUT, VIEWPORT, cursor, 4);

    expect({ x: next.tx, y: next.ty }).toEqual(
      clampPan(LAID_OUT, VIEWPORT, OFFSET, next.scale, { x: next.tx, y: next.ty })
    );
    expect(next.ty).toBe(-100);
  });

  test("clamps the resulting scale to the supported range", () => {
    expect(
      transformAtPoint({ scale: 1, tx: 0, ty: 0 }, LAID_OUT, VIEWPORT, { x: 0, y: 0 }, 99).scale
    ).toBe(MAX_SCALE);
    expect(
      transformAtPoint({ scale: 1, tx: 0, ty: 0 }, LAID_OUT, VIEWPORT, { x: 0, y: 0 }, 0.01).scale
    ).toBe(MIN_SCALE);
  });

  test("returns an already clamped pan so a zoom can never push the photo offscreen", () => {
    const next = transformAtPoint(
      { scale: 1, tx: 0, ty: 0 },
      LAID_OUT,
      VIEWPORT,
      { x: 5, y: 5 },
      2
    );

    expect({ x: next.tx, y: next.ty }).toEqual(
      clampPan(LAID_OUT, VIEWPORT, OFFSET, next.scale, { x: next.tx, y: next.ty })
    );
  });

  test("lands on the centered origin when zooming fully out", () => {
    const zoomed = transformAtPoint(
      { scale: 1, tx: 0, ty: 0 },
      LAID_OUT,
      VIEWPORT,
      { x: 700, y: 700 },
      3
    );
    const back = transformAtPoint(zoomed, LAID_OUT, VIEWPORT, { x: 700, y: 700 }, 1 / 3);
    expect(back).toEqual({ scale: 1, tx: 0, ty: 0 });
  });
});
