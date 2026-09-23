"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";

type FinalPhoto = {
  id: string;
  url: string;
  position: number;
  createdAt: number | null;
};

type Props = {
  appointmentId: string;
  onChange?: () => void;
};

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

export function GalleryPublishControl({ appointmentId, onChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<FinalPhoto[]>([]);
  const [shared, setShared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/final-photos`);
      if (!res.ok) throw new Error("No se pudieron cargar las fotos");
      const data = await res.json();
      setPhotos(data.photos ?? []);
      setShared(Boolean(data.sharedToGallery));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleShare(next: boolean) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareToGallery: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo actualizar");
      }
      setShared(next);
      window.dispatchEvent(new Event("gallery:refresh"));
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      selected.forEach((f) => formData.append("files", f));
      const res = await fetch(`/api/appointments/${appointmentId}/final-photos`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudieron subir las fotos");
      }
      e.target.value = "";
      await load();
      window.dispatchEvent(new Event("gallery:refresh"));
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(photoId: string) {
    if (!confirm("¿Eliminar esta foto final?")) return;
    setDeletingId(photoId);
    setError("");
    try {
      const res = await fetch(
        `/api/appointments/${appointmentId}/final-photos?photoId=${photoId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo eliminar");
      }
      await load();
      window.dispatchEvent(new Event("gallery:refresh"));
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-500">
        Cargando fotos finales...
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-700">Muro de inspiración</p>
          <p className="text-xs text-gray-500">
            {photos.length} foto{photos.length === 1 ? "" : "s"} final{photos.length === 1 ? "" : "es"} guardada{photos.length === 1 ? "" : "s"}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            shared ? "bg-pink-50 text-pink-main" : "bg-gray-100 text-gray-500"
          }`}
        >
          {shared ? "Publicado" : "No publicado"}
        </span>
      </div>

      <label className="mb-3 flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={shared}
          disabled={saving}
          onChange={(e) => toggleShare(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-pink-main focus:ring-pink-main disabled:opacity-50"
        />
        <span className="font-medium">Publicar en el muro de inspiración</span>
      </label>

      {photos.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative">
              <Image
                src={p.url}
                alt="Foto final"
                width={64}
                height={64}
                className="h-16 w-16 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => handleDelete(p.id)}
                disabled={deletingId === p.id}
                className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-xs text-white disabled:opacity-50"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-3 text-sm text-gray-400">No hay fotos finales guardadas.</p>
      )}

      <label className={`${inputCls} flex cursor-pointer items-center justify-center gap-2 border-dashed text-gray-600 hover:bg-gray-50 transition-colors`}>
        {uploading ? "Subiendo..." : "Subir fotos adicionales"}
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleUpload}
          disabled={uploading}
        />
      </label>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
