"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { FilterPills } from "./FilterPills";
import { PhotoLightbox, usePhotoLightbox, type LightboxPhoto } from "./PhotoLightbox";

type GalleryItem = {
  id: string;
  url: string;
  clientName: string | null;
  serviceName: string | null;
  serviceId: string | null;
  appointmentId: string | null;
};

function caption(item: GalleryItem): string {
  return [item.serviceName, item.clientName ? `modelo de ${item.clientName}` : null]
    .filter(Boolean)
    .join(" · ");
}

export function GalleryGrid() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState("");
  const lightbox = usePhotoLightbox();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const fetchItems = useCallback(
    async (reset = false) => {
      if (loading) return;
      setLoading(true);
      const params = new URLSearchParams();
      if (!reset && cursor) params.set("cursor", cursor);
      if (activeFilter) params.set("filter", activeFilter);
      params.set("limit", "20");

      const res = await fetch(`/api/gallery?${params}`);
      const data = await res.json();

      setItems((prev) => {
        if (reset) {
          seenIdsRef.current = new Set();
        }
        const merged = reset ? data.items : [...prev, ...data.items];
        const unique = merged.filter((it: GalleryItem) => {
          if (seenIdsRef.current.has(it.id)) return false;
          seenIdsRef.current.add(it.id);
          return true;
        });
        return unique;
      });
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
      setLoading(false);
    },
    [cursor, activeFilter, loading]
  );

  useEffect(() => {
    setCursor(null);
    setHasMore(true);
    seenIdsRef.current = new Set();
    void fetchItems(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasMore && !loading) {
          void fetchItems(false);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchItems, hasMore, loading]);

  // El visor navega sobre un snapshot de lo cargado, así que abrir una foto
  // antes de que termine el scroll infinito no pierde la lista actual.
  const galleryPhotos = useMemo<LightboxPhoto[]>(
    () =>
      items.map((item) => ({
        id: item.id,
        url: item.url,
        caption: caption(item),
      })),
    [items]
  );

  if (items.length === 0 && !loading) {
    return (
      <div>
        <FilterPills activeFilter={activeFilter} onFilterChange={setActiveFilter} />
        <p className="mt-8 text-center text-sm text-gray-400">
          Aún no hay fotos compartidas
        </p>
      </div>
    );
  }

  return (
    <div>
      <FilterPills activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      <div className="mt-6 columns-2 gap-3 sm:columns-3">
        {items.map((item, index) => (
          <button
            key={item.id}
            onClick={() => lightbox.open(galleryPhotos, index)}
            className="mb-3 block w-full cursor-zoom-in break-inside-avoid overflow-hidden rounded-xl bg-gray-soft text-left transition-shadow hover:shadow-md"
          >
            <div className="relative aspect-square">
              <Image
                fill
                sizes="(max-width: 640px) 50vw, 33vw"
                src={item.url}
                alt={item.clientName ? `Uñas de ${item.clientName}` : "Inspiración de uñas"}
                className="object-cover"
              />
            </div>
            <div className="p-3">
              <p className="text-sm font-medium text-gray-900">
                {item.clientName ?? item.serviceName ?? "Inspiración"}
              </p>
              {item.clientName && item.serviceName && (
                <p className="text-xs text-gray-500">{item.serviceName}</p>
              )}
            </div>
          </button>
        ))}
      </div>
      <div ref={sentinelRef} className="h-10" />
      {loading && (
        <p className="mt-2 text-center text-sm text-gray-400">Cargando...</p>
      )}

      <PhotoLightbox
        {...lightbox}
        footer={
          lightbox.photos[lightbox.index] ? (
            <GalleryFooter
              item={
                items.find((it) => it.id === lightbox.photos[lightbox.index]?.id) ?? null
              }
              onClose={lightbox.onClose}
            />
          ) : null
        }
      />
    </div>
  );
}

function GalleryFooter({ item, onClose }: { item: GalleryItem | null; onClose: () => void }) {
  if (!item) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">
          {item.serviceId ? "¿Agendar un servicio similar con este modelo?" : "Inspiración"}
        </p>
        <p className="text-xs text-white/60">
          {item.clientName
            ? `${item.serviceName ?? ""} · modelo de ${item.clientName}`
            : item.serviceName ?? "Foto destacada del salón"}
        </p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-white/25 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition-colors"
        >
          Cerrar
        </button>
        {item.serviceId && (
          <Link
            href={`/book?serviceId=${item.serviceId}&referencePhotoUrl=${encodeURIComponent(item.url)}`}
            onClick={onClose}
            className="rounded-xl bg-pink-main px-4 py-2 text-center text-sm font-medium text-gray-900 hover:bg-pink-light transition-colors"
          >
            Agendar
          </Link>
        )}
      </div>
    </div>
  );
}
