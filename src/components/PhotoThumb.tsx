"use client";

import Image from "next/image";
import type { LightboxPhoto } from "./PhotoLightbox";

type Props = {
  /** Grupo de fotos navegables en el visor; `index` es la que se muestra. */
  photos: LightboxPhoto[];
  index: number;
  onOpen: (photos: LightboxPhoto[], index: number) => void;
  width: number;
  height: number;
  sizes?: string;
  className?: string;
  imageClassName?: string;
};

/**
 * Miniatura clickeable que abre el visor. Mantiene `next/image` (y su
 * optimización) para las miniaturas; el visor en sí carga el archivo original
 * porque ahí sí importa el detalle completo.
 */
export function PhotoThumb({
  photos,
  index,
  onOpen,
  width,
  height,
  sizes,
  className = "",
  imageClassName = "object-cover",
}: Props) {
  const photo = photos[index];
  if (!photo) return null;

  return (
    <button
      type="button"
      onClick={() => onOpen(photos, index)}
      aria-label={`Ampliar foto${photo.caption ? `: ${photo.caption}` : ""}`}
      title="Ampliar"
      className={`cursor-zoom-in overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-main ${className}`}
    >
      <Image
        src={photo.url}
        alt={photo.caption ?? "Foto"}
        width={width}
        height={height}
        sizes={sizes}
        className={`h-full w-full ${imageClassName}`}
      />
    </button>
  );
}
