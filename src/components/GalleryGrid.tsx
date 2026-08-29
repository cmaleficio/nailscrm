"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { FilterPills } from "./FilterPills";

type GalleryItem = {
  id: string;
  url: string;
  clientName: string | null;
  serviceName: string | null;
  serviceId: string | null;
  appointmentId: string | null;
};

export function GalleryGrid() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState("");
  const [selected, setSelected] = useState<GalleryItem | null>(null);
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
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelected(item)}
            className="mb-3 block w-full break-inside-avoid overflow-hidden rounded-xl bg-gray-soft text-left transition-shadow hover:shadow-md"
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

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="relative aspect-square">
              <Image
                fill
                sizes="(max-width: 640px) 100vw, 448px"
                src={selected.url}
                alt={selected.clientName ? `Uñas de ${selected.clientName}` : "Inspiración de uñas"}
                className="object-cover"
              />
            </div>
            <div className="p-5">
              <p className="font-medium text-gray-900">
                {selected.serviceId ? "¿Agendar un servicio similar con este modelo?" : "Inspiración"}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {selected.clientName
                  ? `${selected.serviceName ?? ""} · modelo de ${selected.clientName}`
                  : selected.serviceName ?? "Foto destacada del salón"}
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cerrar
                </button>
                {selected.serviceId && (
                  <Link
                    href={`/book?serviceId=${selected.serviceId}&referencePhotoUrl=${encodeURIComponent(selected.url)}`}
                    onClick={() => setSelected(null)}
                    className="flex-1 rounded-xl bg-pink-main px-4 py-2 text-center text-sm font-medium text-gray-900 hover:bg-pink-light transition-colors"
                  >
                    Agendar
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
