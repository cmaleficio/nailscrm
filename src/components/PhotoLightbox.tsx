"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isSameOriginUrl, photoDownloadName } from "@/lib/download-name";
import {
  MAX_SCALE,
  clampPan,
  containOffset,
  containSize,
  distance,
  midpoint,
  tapZoomScale,
  transformAtPoint,
  zoomFactor,
  type Point,
  type Size,
  type ZoomTransform,
} from "@/lib/zoom";

export type LightboxPhoto = {
  id: string;
  url: string;
  /** Se usa como pie de foto y como base del nombre de descarga. */
  caption?: string | null;
};

type Props = {
  photos: LightboxPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** Contenido opcional bajo la foto (p. ej. el CTA "Agendar" del muro). */
  footer?: ReactNode;
};

const IDENTITY: ZoomTransform = { scale: 1, tx: 0, ty: 0 };
const DOUBLE_TAP_MS = 300;
const DRAG_SLOP_PX = 8;
const WHEEL_STEP = 0.15;

/**
 * El overlay se abre por encima de los diálogos del admin, que usan z-50.
 * El scroll del body se bloquea con un contador porque el visor se abre encima
 * de otro overlay (el drawer del CRM) y no puede restaurarlo antes de tiempo.
 */
let scrollLocks = 0;
let savedOverflow = "";

function lockScroll() {
  if (scrollLocks === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  scrollLocks += 1;
}

function unlockScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) {
    document.body.style.overflow = savedOverflow;
  }
}

export function PhotoLightbox({ photos, index, onIndexChange, onClose, footer }: Props) {
  const photo = photos[index];
  // Todos los hooks se ejecutan antes del `return null` de la línea de abajo, así
  // que los efectos con efectos secundarios deben preguntar por `active` o el
  // visor bloquearía la página estando cerrado.
  const active = photo !== undefined;
  const [transform, setTransform] = useState<ZoomTransform>(IDENTITY);
  const [natural, setNatural] = useState<Size | null>(null);
  const [viewport, setViewport] = useState<Size>({ w: 0, h: 0 });
  const [loaded, setLoaded] = useState(false);
  const [origin, setOrigin] = useState<string | null>(null);

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const transformRef = useRef<ZoomTransform>(IDENTITY);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ spread: number; center: Point } | null>(null);
  const drag = useRef<{ tx: number; ty: number; x: number; y: number; moved: boolean } | null>(null);
  const lastTap = useRef(0);

  const apply = useCallback((next: ZoomTransform) => {
    transformRef.current = next;
    setTransform(next);
  }, []);

  useEffect(() => setOrigin(window.location.origin), []);

  // El viewport del visor es el espacio disponible: la superficie menos la barra superior.
  useEffect(() => {
    const node = surfaceRef.current;
    if (!node) return;
    const measure = () => setViewport({ w: node.clientWidth, h: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Cambiar de foto reinicia el zoom y el desplazamiento.
  useEffect(() => {
    transformRef.current = IDENTITY;
    setTransform(IDENTITY);
    setNatural(null);
    setLoaded(false);
  }, [index]);

  useEffect(() => {
    if (!active) return;
    lockScroll();
    return unlockScroll;
  }, [active]);

  const laidOut = useMemo(
    () => (natural ? containSize(natural, viewport) : { w: 0, h: 0 }),
    [natural, viewport]
  );
  const offset = useMemo(() => containOffset(laidOut, viewport), [laidOut, viewport]);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= photos.length) return;
      onIndexChange(next);
    },
    [onIndexChange, photos.length]
  );

  const zoomBy = useCallback(
    (factor: number, center: Point) => {
      apply(transformAtPoint(transformRef.current, laidOut, viewport, center, factor));
    },
    [apply, laidOut, viewport]
  );

  const reset = useCallback(() => apply(IDENTITY), [apply]);

  // Rueda del ratón: se registra de forma nativa para poder hacer preventDefault.
  useEffect(() => {
    const node = surfaceRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      const factor =
        event.deltaY < 0
          ? 1 + WHEEL_STEP
          : 1 / (1 + WHEEL_STEP);
      zoomBy(factor, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") goTo(index + 1);
      else if (event.key === "ArrowLeft") goTo(index - 1);
      else if (event.key === "+" || event.key === "=") zoomBy(1 + WHEEL_STEP, center());
      else if (event.key === "-") zoomBy(1 / (1 + WHEEL_STEP), center());
      else if (event.key === "0") reset();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, goTo, index, onClose, reset, zoomBy]);

  function center(): Point {
    return { x: viewport.w / 2, y: viewport.h / 2 };
  }

  if (!photo) return null;

  const external = origin ? !isSameOriginUrl(photo.url, origin) : false;
  const fileName = photoDownloadName({ base: photo.caption, url: photo.url });
  const multiple = photos.length > 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption ?? "Visor de fotos"}
      className="fixed inset-0 z-[70] flex flex-col bg-black/95"
    >
      {/* Barra superior: contador, pie de foto y acciones */}
      <div className="flex shrink-0 items-center gap-2 px-3 py-2 text-white sm:px-4">
        {multiple && (
          <span className="shrink-0 text-xs tabular-nums text-white/60">
            {index + 1} / {photos.length}
          </span>
        )}
        <p className="min-w-0 flex-1 truncate text-sm">{photo.caption ?? ""}</p>

        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            label="Alejar"
            disabled={transform.scale <= 1}
            onClick={() => zoomBy(1 / (1 + WHEEL_STEP), center())}
          >
            <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth={2}>
              <path strokeLinecap="round" d="M5 12h14" />
            </svg>
          </IconButton>
          <button
            type="button"
            onClick={reset}
            title="Restablecer zoom"
            className="min-w-[3.25rem] rounded-lg px-2 py-2 text-xs tabular-nums text-white/80 hover:bg-white/10"
          >
            {Math.round(transform.scale * 100)}%
          </button>
          <IconButton
            label="Acercar"
            disabled={transform.scale >= MAX_SCALE}
            onClick={() => zoomBy(1 + WHEEL_STEP, center())}
          >
            <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth={2}>
              <path strokeLinecap="round" d="M12 5v14M5 12h14" />
            </svg>
          </IconButton>

          {external ? (
            <a
              href={photo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white/90 hover:bg-white/10"
            >
              <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth={2} className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
              </svg>
              Abrir
            </a>
          ) : (
            <a
              href={photo.url}
              download={fileName}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white/90 hover:bg-white/10"
            >
              <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth={2} className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v11m0 0 4-4m-4 4-4-4M4 19h16" />
              </svg>
              Descargar
            </a>
          )}

          <IconButton label="Cerrar" onClick={onClose}>
            <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth={2}>
              <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </IconButton>
        </div>
      </div>

      {/* Superficie de zoom / arrastre */}
      <div
        ref={surfaceRef}
        className={`relative min-h-0 flex-1 select-none ${
          transform.scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
        }`}
        style={{ touchAction: "none" }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          const current = transformRef.current;
          drag.current = { tx: current.tx, ty: current.ty, x: event.clientX, y: event.clientY, moved: false };

          if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            pinch.current = { spread: distance(a, b), center: midpoint(a, b) };
          }
        }}
        onPointerMove={(event) => {
          if (!pointers.current.has(event.pointerId)) return;
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          const current = transformRef.current;
          const start = drag.current;
          if (!start) return;

          if (
            Math.abs(event.clientX - start.x) > DRAG_SLOP_PX ||
            Math.abs(event.clientY - start.y) > DRAG_SLOP_PX
          ) {
            start.moved = true;
          }

          // Pellizco de dos dedos: escala desde el centro del gesto y desplaza con el centro.
          if (pointers.current.size >= 2 && pinch.current) {
            const [a, b] = [...pointers.current.values()];
            const spread = distance(a, b);
            const center = midpoint(a, b);
            const factor = zoomFactor(spread, pinch.current.spread);
            const scaled = transformAtPoint(current, laidOut, viewport, pinch.current.center, factor);
            const shifted = clampPan(laidOut, viewport, offset, scaled.scale, {
              x: scaled.tx + (center.x - pinch.current.center.x),
              y: scaled.ty + (center.y - pinch.current.center.y),
            });
            apply({ scale: scaled.scale, tx: shifted.x, ty: shifted.y });
            pinch.current = { spread, center };
            return;
          }

          // Un dedo o el ratón: solo desplaza si ya hay zoom.
          if (current.scale > 1) {
            const pan = clampPan(laidOut, viewport, offset, current.scale, {
              x: start.tx + (event.clientX - start.x),
              y: start.ty + (event.clientY - start.y),
            });
            apply({ scale: current.scale, tx: pan.x, ty: pan.y });
          }
        }}
        onPointerUp={(event) => {
          pointers.current.delete(event.pointerId);
          if (pointers.current.size < 2) pinch.current = null;
          if (pointers.current.size > 0) return;

          const wasDrag = drag.current?.moved ?? false;
          drag.current = null;

          // Doble toque o doble clic: alterna entre ajustar y acercar.
          if (!wasDrag) {
            const now = Date.now();
            if (now - lastTap.current < DOUBLE_TAP_MS) {
              lastTap.current = 0;
              const target = tapZoomScale(transformRef.current.scale);
              if (target > 1) zoomBy(target, center());
              else reset();
            } else {
              lastTap.current = now;
            }
          }
        }}
        onPointerCancel={(event) => {
          pointers.current.delete(event.pointerId);
          pinch.current = null;
          drag.current = null;
        }}
      >
        {!loaded && <p className="absolute inset-0 pt-6 text-center text-sm text-white/50">Cargando…</p>}

        <div
          className="absolute"
          style={{ left: offset.x, top: offset.y, transform: `translate(${transform.tx}px, ${transform.ty}px)` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={photo.id}
            src={photo.url}
            alt={photo.caption ?? "Foto"}
            draggable={false}
            onLoad={(event) => {
              setNatural({ w: event.currentTarget.naturalWidth, h: event.currentTarget.naturalHeight });
              setLoaded(true);
            }}
            className={natural ? undefined : "h-full w-full object-contain"}
            style={
              natural
                ? {
                    width: laidOut.w,
                    height: laidOut.h,
                    transform: `scale(${transform.scale})`,
                    transformOrigin: "0 0",
                  }
                : undefined
            }
          />
        </div>

        {multiple && (
          <>
            <NavButton side="left" onClick={() => goTo(index - 1)} />
            <NavButton side="right" onClick={() => goTo(index + 1)} />
          </>
        )}
      </div>

      {footer && (
        <div className="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-white sm:px-4">
          {footer}
        </div>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded-lg p-2 text-white/90 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5">
        {children}
      </svg>
    </button>
  );
}

function NavButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Foto anterior" : "Foto siguiente"}
      className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 ${
        side === "left" ? "left-2" : "right-2"
      }`}
    >
      <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth={2} className="h-5 w-5">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={side === "left" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"}
        />
      </svg>
    </button>
  );
}

export type PhotoLightboxState = {
  photos: LightboxPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  open: (photos: LightboxPhoto[], index?: number) => void;
};

/**
 * Estado del visor para las pantallas que tienen varios puntos de entrada:
 * se monta un solo <PhotoLightbox {...lightbox} /> y cada miniatura llama a
 * `open(fotos, i)`.
 */
export function usePhotoLightbox(): PhotoLightboxState {
  const [photos, setPhotos] = useState<LightboxPhoto[]>([]);
  const [index, setIndex] = useState(0);

  const open = useCallback((next: LightboxPhoto[], at = 0) => {
    if (next.length === 0) return;
    setPhotos(next);
    setIndex(Math.min(Math.max(at, 0), next.length - 1));
  }, []);

  const onClose = useCallback(() => setPhotos([]), []);

  const onIndexChange = useCallback(
    (next: number) => setIndex(Math.min(Math.max(next, 0), Math.max(photos.length - 1, 0))),
    [photos.length]
  );

  return { photos, index, onIndexChange, onClose, open };
}
