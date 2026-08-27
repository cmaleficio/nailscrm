"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

export function BrandContent() {
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/brand")
      .then((r) => r.json())
      .then((data) => {
        if (data.name) setName(data.name);
        if (data.logo_url) setLogoUrl(data.logo_url);
      })
      .catch(() => {});
  }, []);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Error al subir imagen");
      const data = await res.json();
      setLogoUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir imagen");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/brand", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, logo_url: logoUrl }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar");
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Identidad de Marca</h1>
        <p className="text-sm text-gray-500">
          Configura el nombre y logo de tu salón
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-6">
          {/* Logo */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Logo del salón
            </label>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-gray-200">
                  <Image
                    src={logoUrl}
                    alt="Logo"
                    fill
                    className="object-contain"
                  />
                </div>
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50">
                  <span className="text-3xl">💅</span>
                </div>
              )}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {uploading ? "Subiendo..." : logoUrl ? "Cambiar logo" : "Subir logo"}
                </button>
                {logoUrl && (
                  <button
                    onClick={() => setLogoUrl("")}
                    className="ml-2 rounded-xl border border-gray-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label
              htmlFor="salon-name"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Nombre del salón
            </label>
            <input
              id="salon-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-pink-main focus:outline-none"
              placeholder="Ej: DreamNails Studio"
            />
          </div>

          {/* Preview */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
              Vista previa
            </p>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <div className="relative h-10 w-10 overflow-hidden rounded-lg">
                  <Image
                    src={logoUrl}
                    alt="Logo"
                    fill
                    className="object-contain"
                  />
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-light text-xl">
                  💅
                </div>
              )}
              <span className="text-lg font-semibold text-gray-900">
                {name || "Nombre del salón"}
              </span>
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        {saved && (
          <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600">
            Identidad de marca guardada
          </p>
        )}

        <button
          onClick={save}
          disabled={saving || !name.trim()}
          className="mt-4 w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {saving ? "Guardando..." : "Guardar identidad"}
        </button>
      </div>
    </div>
  );
}
