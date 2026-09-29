"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PhotoLightbox, usePhotoLightbox } from "@/components/PhotoLightbox";
import type { ProductionDay } from "@/lib/production-photos";

type GalleryPhoto = {
  id: string;
  url: string;
  serviceId: string | null;
  serviceName: string | null;
  caption: string | null;
  createdAt: number | null;
};

type ServiceOption = {
  id: string;
  name: string;
};

type ProductionPhoto = {
  id: string;
  url: string;
  startTime: number | null;
  clientId: string;
  clientName: string;
  serviceId: string;
  serviceName: string;
  date: string;
  caption: string;
};

type Tab = "wall" | "production";

const inputCls = "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm";

export function GalleryContent() {
  const [tab, setTab] = useState<Tab>("wall");
  const [services, setServices] = useState<ServiceOption[]>([]);

  useEffect(() => {
    fetch("/api/services?includeInactive=1")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ServiceOption[]) => setServices(data))
      .catch(() => setServices([]));
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Fotos</h1>
        <p className="text-sm text-gray-500">
          Gestiona el muro de inspiración y consulta el archivo de trabajos
          finalizados, agrupado por día.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {(
          [
            ["wall", "Muro de inspiración"],
            ["production", "Producción"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? "bg-pink-main text-gray-900"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "wall" ? (
        <WallTab services={services} />
      ) : (
        <ProductionTab services={services} />
      )}
    </div>
  );
}

function WallTab({ services }: { services: ServiceOption[] }) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleting, setDeleting] = useState<GalleryPhoto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const lightbox = usePhotoLightbox();

  const lightboxPhotos = useMemo(
    () =>
      photos.map((photo) => ({
        id: photo.id,
        url: photo.url,
        caption: photo.caption ?? photo.serviceName,
      })),
    [photos]
  );

  const fetchPhotos = useCallback(async () => {
    const res = await fetch("/api/gallery-photos");
    if (res.ok) {
      setPhotos(await res.json());
    }
  }, []);

  useEffect(() => {
    void fetchPhotos();
  }, [fetchPhotos]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = "";
    setUploading(true);
    setError("");
    setSuccess("");
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        if (serviceId) formData.append("serviceId", serviceId);
        if (caption.trim()) formData.append("caption", caption.trim());
        const res = await fetch("/api/gallery-photos", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "No se pudo subir una foto");
        }
      }
      setSuccess(
        files.length === 1
          ? "Foto publicada en el muro"
          : `${files.length} fotos publicadas en el muro`
      );
      await fetchPhotos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setUploading(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/gallery-photos/${deleting.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo eliminar la foto");
      }
      setDeleting(null);
      setSuccess("Foto eliminada del muro");
      await fetchPhotos();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {success && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600">
          {success}
        </p>
      )}

      {/* Subir */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          Publicar en el muro
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Servicio asociado (opcional)
            </label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className={inputCls}
            >
              <option value="">Sin servicio</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Descripción (opcional)
            </label>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Ej: Diseño de temporada"
              className={inputCls}
            />
          </div>
        </div>
        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-pink-main px-6 py-2 text-sm font-medium text-gray-900 hover:bg-pink-light transition-colors">
          {uploading ? "Subiendo..." : "Subir fotos"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={uploading}
            className="hidden"
            onChange={handleUpload}
          />
        </label>
      </div>

      {/* Grid de fotos */}
      <div className="columns-2 gap-3 sm:columns-3">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            className="mb-3 break-inside-avoid overflow-hidden rounded-xl border border-gray-200 bg-white"
          >
            <button
              type="button"
              onClick={() => lightbox.open(lightboxPhotos, index)}
              className="relative block aspect-square w-full cursor-zoom-in"
            >
              <Image
                fill
                sizes="(max-width: 640px) 50vw, 33vw"
                src={photo.url}
                alt={photo.caption ?? photo.serviceName ?? "Inspiración de uñas"}
                className="object-cover"
              />
            </button>
            <div className="flex items-center justify-between gap-2 p-2">
              <p className="min-w-0 truncate text-xs text-gray-500">
                {photo.serviceName ?? photo.caption ?? "Sin servicio"}
              </p>
              <button
                onClick={() => {
                  setDeleting(photo);
                  setDeleteError("");
                }}
                className="shrink-0 rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
      {photos.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
          <p className="text-gray-400">
            Aún no hay fotos propias del muro. Sube las primeras para pre-llenarlo.
          </p>
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title="Eliminar foto del muro"
          message="¿Eliminar esta foto del muro de inspiración? Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          danger
          busy={deleteBusy}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}

      <PhotoLightbox {...lightbox} />
    </>
  );
}

const EMPTY_FILTERS = { from: "", to: "", serviceId: "", q: "" };
type Filters = typeof EMPTY_FILTERS;

/**
 * Archivo de trabajos finalizados. Es de solo lectura a propósito: borrar o
 * publicar fotos desde aquí duplicaría la lógica de GalleryPublishControl, que
 * además es la única que controla `shared_to_gallery` a nivel de cita.
 */
function ProductionTab({ services }: { services: ServiceOption[] }) {
  const [days, setDays] = useState<ProductionDay<ProductionPhoto>[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const lightbox = usePhotoLightbox();

  const load = useCallback(
    async (cursor: string | null, append: boolean) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (filters.from) params.set("from", filters.from);
        if (filters.to) params.set("to", filters.to);
        if (filters.serviceId) params.set("serviceId", filters.serviceId);
        if (filters.q.trim()) params.set("q", filters.q.trim());
        if (cursor) params.set("before", cursor);

        const res = await fetch(`/api/production-photos?${params.toString()}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "No se pudo cargar el archivo");
        }
        const data: {
          days: ProductionDay<ProductionPhoto>[];
          nextCursor: string | null;
          hasMore: boolean;
        } = await res.json();

        // El cursor es exclusivo y la primera página descarta las anteriores, así
        // que al cambiar de filtros nunca se concatenan dos rangos distintos.
        setDays((prev) => (append ? [...prev, ...data.days] : data.days));
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado");
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    void load(null, false);
  }, [load]);

  // El visor navega sobre un aplanado de lo cargado para que abrir una foto
  // antes de terminar de paginar no pierda los días siguientes.
  const flatPhotos = useMemo(() => days.flatMap((day) => day.photos), [days]);
  const lightboxPhotos = useMemo(
    () =>
      flatPhotos.map((photo) => ({
        id: photo.id,
        url: photo.url,
        caption: photo.caption,
        // Alimenta el nombre del archivo descargado: "gel-ana-2026-01-12.jpg".
        date: photo.date,
      })),
    [flatPhotos]
  );
  const indexById = useMemo(
    () => new Map(flatPhotos.map((photo, index) => [photo.id, index])),
    [flatPhotos]
  );

  const hasActiveFilters =
    filters.from !== "" ||
    filters.to !== "" ||
    filters.serviceId !== "" ||
    filters.q.trim() !== "";

  return (
    <>
      <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="date"
          aria-label="Desde"
          className={inputCls}
          value={draft.from}
          onChange={(e) => setDraft({ ...draft, from: e.target.value })}
        />
        <input
          type="date"
          aria-label="Hasta"
          className={inputCls}
          value={draft.to}
          onChange={(e) => setDraft({ ...draft, to: e.target.value })}
        />
        <select
          aria-label="Servicio"
          className={inputCls}
          value={draft.serviceId}
          onChange={(e) => setDraft({ ...draft, serviceId: e.target.value })}
        >
          <option value="">Todos los servicios</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          type="search"
          aria-label="Buscar por clienta"
          placeholder="Buscar por clienta…"
          className={inputCls}
          value={draft.q}
          onChange={(e) => setDraft({ ...draft, q: e.target.value })}
        />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilters(draft)}
          className="rounded-lg bg-pink-main px-3 py-1.5 text-sm font-medium text-gray-900 hover:opacity-90"
        >
          Filtrar
        </button>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setDraft(EMPTY_FILTERS);
              setFilters(EMPTY_FILTERS);
            }}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200"
          >
            Limpiar
          </button>
        )}
        <span className="text-xs text-gray-400">
          {flatPhotos.length} foto{flatPhotos.length === 1 ? "" : "s"}
        </span>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {days.map((day) => (
        <section key={day.date} className="mb-8">
          <h2 className="sticky top-0 z-10 -mx-1 mb-3 bg-white/90 px-1 py-2 text-sm font-semibold capitalize text-gray-900 backdrop-blur">
            {day.label}
            <span className="ml-2 text-xs font-normal text-gray-400">
              {day.count} foto{day.count === 1 ? "" : "s"}
            </span>
          </h2>
          <div className="columns-2 gap-3 sm:columns-3">
            {day.photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() =>
                  lightbox.open(lightboxPhotos, indexById.get(photo.id) ?? 0)
                }
                className="mb-3 block w-full break-inside-avoid cursor-zoom-in overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
                <span className="relative block aspect-square w-full">
                  <Image
                    fill
                    sizes="(max-width: 640px) 50vw, 33vw"
                    src={photo.url}
                    alt={photo.caption}
                    className="object-cover"
                  />
                </span>
                <span className="block truncate p-2 text-left text-xs text-gray-500">
                  {photo.caption}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}

      {!loading && days.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
          <p className="text-gray-400">
            {hasActiveFilters
              ? "No hay trabajos finalizados que coincidan con el filtro."
              : "Todavía no hay fotos de citas completadas. Aparecen aquí al completar una cita con fotos finales."}
          </p>
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void load(nextCursor, true)}
            disabled={loading}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50"
          >
            {loading ? "Cargando…" : "Cargar días anteriores"}
          </button>
        </div>
      )}

      <PhotoLightbox {...lightbox} />
    </>
  );
}
