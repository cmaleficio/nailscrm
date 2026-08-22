"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { ConfirmDialog } from "@/components/ConfirmDialog";

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

export function GalleryContent() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleting, setDeleting] = useState<GalleryPhoto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const fetchPhotos = useCallback(async () => {
    const res = await fetch("/api/gallery-photos");
    if (res.ok) {
      setPhotos(await res.json());
    }
  }, []);

  useEffect(() => {
    void fetchPhotos();
    fetch("/api/services?includeInactive=1")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ServiceOption[]) => setServices(data))
      .catch(() => setServices([]));
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
        files.length === 1 ? "Foto publicada en el muro" : `${files.length} fotos publicadas en el muro`
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

  const inputCls = "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Muro de inspiración</h1>
        <p className="text-sm text-gray-500">
          Sube fotos para pre-llenar el muro público sin necesidad de completar una
          cita. Si eliges un servicio, los visitantes podrán agendarlo desde la foto.
        </p>
      </div>

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
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="mb-3 break-inside-avoid overflow-hidden rounded-xl border border-gray-200 bg-white"
          >
            <div className="relative aspect-square">
              <Image
                fill
                sizes="(max-width: 640px) 50vw, 33vw"
                src={photo.url}
                alt={photo.caption ?? photo.serviceName ?? "Inspiración de uñas"}
                className="object-cover"
              />
            </div>
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
    </div>
  );
}
