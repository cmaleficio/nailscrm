export const MIN_SCALE = 1;
export const MAX_SCALE = 5;
/** Escala a la que salta el doble toque/clic: lo bastante cerca para ver el detalle. */
export const TAP_ZOOM_SCALE = 3;

export type Point = { x: number; y: number };
export type Size = { w: number; h: number };

/** Estado de la transformación del visor: escala + desplazamiento en px de pantalla. */
export type ZoomTransform = { scale: number; tx: number; ty: number };

export function clampScale(scale: number, min = MIN_SCALE, max = MAX_SCALE): number {
  if (Number.isNaN(scale)) return min;
  if (scale < min) return min;
  if (scale > max) return max;
  return scale;
}

/**
 * Ajusta el tamaño natural de la foto al viewport sin recortar (object-contain).
 * Devuelve 0 en vez de dividir por cero ante tamaños degenerados.
 */
export function containSize(natural: Size, viewport: Size): Size {
  if (natural.w <= 0 || natural.h <= 0 || viewport.w <= 0 || viewport.h <= 0) {
    return { w: 0, h: 0 };
  }
  const ratio = Math.min(viewport.w / natural.w, viewport.h / natural.h);
  return { w: natural.w * ratio, h: natural.h * ratio };
}

/** Esquina superior izquierda de la foto ajustada cuando no hay desplazamiento. */
export function containOffset(laidOut: Size, viewport: Size): Point {
  return { x: (viewport.w - laidOut.w) / 2, y: (viewport.h - laidOut.h) / 2 };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Factor de escala de un pellizco; 1 si la separación previa era 0 (primer contacto). */
export function zoomFactor(nextSpread: number, prevSpread: number): number {
  if (prevSpread <= 0) return 1;
  return nextSpread / prevSpread;
}

export function tapZoomScale(current: number): number {
  return current > MIN_SCALE + 0.01 ? MIN_SCALE : TAP_ZOOM_SCALE;
}

/**
 * Impide que la foto se arrastre fuera del viewport.
 * Si el lado escalado cabe, se centra en ese eje; si no, se limita a los bordes.
 * Devuelve el desplazamiento a aplicar (no la posición absoluta de la caja).
 */
export function clampPan(
  laidOut: Size,
  viewport: Size,
  offset: Point,
  scale: number,
  translate: Point
): Point {
  const axis = (viewportSize: number, laidOutSize: number, origin: number, t: number) => {
    const scaled = laidOutSize * scale;
    const current = origin + t;
    const center = (viewportSize - scaled) / 2;
    const min = viewportSize - scaled;
    return (scaled <= viewportSize ? center : Math.min(Math.max(current, min), 0)) - origin;
  };

  return {
    x: axis(viewport.w, laidOut.w, offset.x, translate.x),
    y: axis(viewport.h, laidOut.h, offset.y, translate.y),
  };
}

/**
 * Aplica un factor de zoom anclando el punto del contenido que está bajo el cursor,
 * y devuelve la transformación ya acotada: escala dentro de rango y pan dentro del
 * viewport. El clamp va acá a propósito, para que ninguna llamada pueda dejar la
 * foto fuera de la pantalla.
 *
 * Si el cursor cae fuera de la foto (p. ej. sobre el fondo), el anclaje se ajusta
 * al borde visible en vez de dejar la imagen desplazada.
 */
export function transformAtPoint(
  current: ZoomTransform,
  laidOut: Size,
  viewport: Size,
  cursor: Point,
  factor: number
): ZoomTransform {
  const offset = containOffset(laidOut, viewport);
  const scale = clampScale(current.scale * factor);
  const anchor = {
    x: (cursor.x - offset.x - current.tx) / current.scale,
    y: (cursor.y - offset.y - current.ty) / current.scale,
  };
  const pan = clampPan(laidOut, viewport, offset, scale, {
    x: cursor.x - offset.x - anchor.x * scale,
    y: cursor.y - offset.y - anchor.y * scale,
  });
  return { scale, tx: pan.x, ty: pan.y };
}
