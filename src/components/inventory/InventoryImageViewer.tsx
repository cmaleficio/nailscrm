"use client";

import { type ReactNode } from "react";
import { PhotoLightbox, usePhotoLightbox, type LightboxPhoto } from "@/components/PhotoLightbox";
import { photoDownloadName } from "@/lib/download-name";

type InventoryImageViewerProps = {
  photoUrls: string[];
  itemName: string;
  fallback?: ReactNode;
};

export function InventoryImageViewer({ photoUrls, itemName, fallback }: InventoryImageViewerProps) {
  const lightbox = usePhotoLightbox();

  const handleOpen = (index: number) => {
    const photos: LightboxPhoto[] = photoUrls.map((url, i) => ({
      id: i.toString(),
      url,
      caption: itemName,
    }));
    lightbox.open(photos, index);
  };

  const hasPhotos = photoUrls.length > 0;

  return (
    <div className="relative">
      {hasPhotos ? (
        <div className="grid grid-cols-2 gap-2">
          {photoUrls.map((url, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleOpen(index)}
              className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 hover:opacity-80 transition-opacity"
              aria-label={`Ver imagen ${index + 1} de ${itemName}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${itemName} - imagen ${index + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              {photoUrls.length > 1 && index === photoUrls.length - 1 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-sm font-medium">
                  +{photoUrls.length - 1}
                </div>
              )}
            </button>
          ))}
        </div>
      ) : (
        fallback ?? (
          <div className="aspect-square rounded-lg bg-gray-100 flex items-center justify-center">
            <svg className="h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )
      )}
      <PhotoLightbox
        photos={lightbox.photos}
        index={lightbox.index}
        onIndexChange={lightbox.onIndexChange}
        onClose={lightbox.onClose}
        footer={
          lightbox.photos.length > 0 && lightbox.photos[lightbox.index] ? (
            <a
              href={lightbox.photos[lightbox.index].url}
              download={photoDownloadName({
                base: lightbox.photos[lightbox.index].caption,
                url: lightbox.photos[lightbox.index].url,
              })}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white/90 hover:bg-white/10"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth={2} className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v11m0 0 4-4m-4 4-4-4M4 19h16" />
              </svg>
              Descargar
            </a>
          ) : null
        }
      />
    </div>
  );
}