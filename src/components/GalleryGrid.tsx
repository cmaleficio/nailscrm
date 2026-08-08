"use client";

import { useState, useEffect, useCallback } from "react";
import { FilterPills } from "./FilterPills";

type GalleryItem = {
  id: string;
  finalPhotoUrl: string;
  clientName: string;
  serviceName: string;
};

export function GalleryGrid() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState("");

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
          <div
            key={item.id}
            className="mb-3 break-inside-avoid rounded-xl bg-gray-soft overflow-hidden"
          >
            <img
              src={item.finalPhotoUrl}
              alt={`Uñas de ${item.clientName}`}
              className="w-full object-cover"
              loading="lazy"
            />
            <div className="p-3">
              <p className="text-sm font-medium text-gray-900">
                {item.clientName}
              </p>
              <p className="text-xs text-gray-500">{item.serviceName}</p>
            </div>
          </div>
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
    </div>
  );
}
