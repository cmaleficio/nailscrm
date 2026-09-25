"use client";

import { useState } from "react";
import Image from "next/image";
import type { LightboxPhoto } from "./PhotoLightbox";

type Props = {
  photos: LightboxPhoto[];
  /** "Modelos de referencia" en el CRM del admin, "Tus uñas" en el perfil. */
  title?: string;
  frameClassName?: string;
  sizes?: string;
  /** Si se pasa, la imagen abre el visor con todas las fotos del grupo. */
  onOpen?: (photos: LightboxPhoto[], index: number) => void;
};

/**
 * Carrusel de fotos de una cita. Se usa en el CRM del admin (modelos de
 * referencia que sube la clienta) y en el perfil (resultados finales que sube
 * el admin), así que el título y el marco son configurables.
 */
export function PhotoCarousel({
  photos,
  title = "Modelos de referencia",
  frameClassName = "h-52",
  sizes = "(max-width: 768px) 100vw, 33vw",
  onOpen,
}: Props) {
  const [index, setIndex] = useState(0);
  if (photos.length === 0) return null;
  const current = photos[Math.min(index, photos.length - 1)];
  const prev = () => setIndex((i) => (i - 1 + photos.length) % photos.length);
  const next = () => setIndex((i) => (i + 1) % photos.length);

  return (
    <div className="mb-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      <div className="relative overflow-hidden rounded-xl bg-gray-soft">
        <div
          className={`relative ${frameClassName} ${
            onOpen ? "cursor-zoom-in" : ""
          }`}
          onClick={onOpen ? () => onOpen(photos, Math.min(index, photos.length - 1)) : undefined}
          role={onOpen ? "button" : undefined}
          tabIndex={onOpen ? 0 : undefined}
          onKeyDown={
            onOpen
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen(photos, Math.min(index, photos.length - 1));
                  }
                }
              : undefined
          }
          aria-label={onOpen ? `Ampliar foto: ${current.caption ?? ""}` : undefined}
        >
          <Image
            fill
            sizes={sizes}
            src={current.url}
            alt={current.caption ?? "Foto de la cita"}
            className="object-cover"
          />
        </div>
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Foto anterior"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 hover:bg-white transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Foto siguiente"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 hover:bg-white transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Ver foto ${i + 1}`}
              aria-current={i === index}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === index ? "bg-pink-main" : "bg-gray-300"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
