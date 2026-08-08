"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { FilterPills } from "./FilterPills";

type GalleryItem = {
  id: string;
  url: string;
  clientName: string;
  serviceName: string;
  serviceId: string;
  appointmentId: string;
};

export function GalleryGrid() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState("");
  const [selected, setSelected] = useState<GalleryItem | null>(null);

  const fetchItems = useCallback(
    async (reset = false) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (!reset && cursor) params.set("cursor", cursor);
      if (activeFilter) params.set("filter", activeFilter);
      params.set("limit", "10");

      const res = await fetch(`/api/gallery?${params}`);
      const data = await res.json();

      if (reset) {
        setItems(data.items);
        setCursor(null);
        setHasMore(data.hasMore);
      } else {
        setItems((prev) => [...prev, ...data.items]);
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
      }
      setLoading(false);
    },
    [cursor, activeFilter]
  );

  useEffect(() => {
    void fetchItems(true);
  }, [fetchItems, activeFilter]);

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
            <img
              src={item.url}
              alt={`Uñas de ${item.clientName}`}
              className="w-full object-cover"
              loading="lazy"
            />
            <div className="p-3">
              <p className="text-sm font-medium text-gray-900">{item.clientName}</p>
              <p className="text-xs text-gray-500">{item.serviceName}</p>
            </div>
          </button>
        ))}
      </div>
      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={() => fetchItems(false)}
            disabled={loading}
            className="rounded-xl border border-gray-200 bg-white px-6 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {loading ? "Cargando..." : "Cargar más"}
          </button>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
            <img src={selected.url} alt={`Uñas de ${selected.clientName}`} className="w-full object-cover" />
            <div className="p-5">
              <p className="font-medium text-gray-900">¿Agendar un servicio similar con este modelo?</p>
              <p className="mt-1 text-sm text-gray-500">
                {selected.serviceName} · modelo de {selected.clientName}
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cerrar
                </button>
                <Link
                  href={`/book?serviceId=${selected.serviceId}&referencePhotoUrl=${encodeURIComponent(selected.url)}`}
                  onClick={() => setSelected(null)}
                  className="flex-1 rounded-xl bg-pink-main px-4 py-2 text-center text-sm font-medium text-gray-900 hover:bg-pink-light transition-colors"
                >
                  Agendar
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
