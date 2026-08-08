"use client";

import { useState, useEffect, useCallback } from "react";

type Service = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationMins: number;
  isActive: number;
};

type EditingState = {
  id: string;
  name: string;
  description: string;
  price: string;
  durationMins: string;
};

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  durationMins: "",
};

export function ServicesContent() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<EditingState | null>(null);

  const fetchServices = useCallback(async () => {
    const res = await fetch("/api/services?includeInactive=1");
    if (res.ok) {
      setServices(await res.json());
    }
  }, []);

  useEffect(() => {
    void fetchServices();
  }, [fetchServices]);

  function handleChange(
    setter: React.Dispatch<React.SetStateAction<typeof form>>
  ) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      setter((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };
  }

  async function handleCreate() {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          price: parseFloat(form.price),
          durationMins: parseInt(form.durationMins, 10),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo crear el servicio");
      }
      setForm(EMPTY_FORM);
      setSuccess("Servicio creado");
      await fetchServices();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await fetch(`/api/services/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editing.name,
          description: editing.description,
          price: parseFloat(editing.price),
          durationMins: parseInt(editing.durationMins, 10),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar el servicio");
      }
      setEditing(null);
      setSuccess("Servicio actualizado");
      await fetchServices();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(service: Service) {
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/services/${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: service.isActive === 1 ? false : true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo cambiar el estado");
      }
      setSuccess(service.isActive === 1 ? "Servicio desactivado" : "Servicio activado");
      await fetchServices();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  }

  function startEdit(service: Service) {
    setEditing({
      id: service.id,
      name: service.name,
      description: service.description ?? "",
      price: String(service.price),
      durationMins: String(service.durationMins),
    });
  }

  const inputCls =
    "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Servicios</h1>
        <p className="text-sm text-gray-500">
          Crea y edita los servicios que aparecen en el catálogo del inicio.
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

      {/* Nuevo servicio */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          Nuevo servicio
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nombre
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange(setForm)}
              placeholder="Ej: Acrílicas Full"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Descripción
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange(setForm)}
              placeholder="Breve descripción del servicio"
              rows={2}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Precio ($)
            </label>
            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={handleChange(setForm)}
              placeholder="25.00"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Duración (min)
            </label>
            <input
              name="durationMins"
              type="number"
              min="1"
              step="5"
              value={form.durationMins}
              onChange={handleChange(setForm)}
              placeholder="60"
              className={inputCls}
            />
          </div>
        </div>
        <button
          onClick={handleCreate}
          disabled={loading || !form.name || !form.price || !form.durationMins}
          className="mt-4 rounded-xl bg-pink-main px-6 py-2 text-sm font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50 transition-colors"
        >
          {loading ? "Creando..." : "Crear servicio"}
        </button>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {services.map((service) => (
          <div
            key={service.id}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            {editing?.id === service.id ? (
              <div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Nombre
                    </label>
                    <input
                      value={editing.name}
                      onChange={(e) =>
                        setEditing((prev) =>
                          prev ? { ...prev, name: e.target.value } : prev
                        )
                      }
                      className={inputCls}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Descripción
                    </label>
                    <textarea
                      value={editing.description}
                      onChange={(e) =>
                        setEditing((prev) =>
                          prev ? { ...prev, description: e.target.value } : prev
                        )
                      }
                      rows={2}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Precio ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editing.price}
                      onChange={(e) =>
                        setEditing((prev) =>
                          prev ? { ...prev, price: e.target.value } : prev
                        )
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Duración (min)
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="5"
                      value={editing.durationMins}
                      onChange={(e) =>
                        setEditing((prev) =>
                          prev ? { ...prev, durationMins: e.target.value } : prev
                        )
                      }
                      className={inputCls}
                    />
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={loading}
                    className="rounded-xl bg-pink-main px-4 py-2 text-sm font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50 transition-colors"
                  >
                    {loading ? "Guardando..." : "Guardar"}
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="rounded-xl bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-gray-900">
                        {service.name}
                      </h3>
                      <span
                        className={`rounded-lg px-2 py-0.5 text-xs font-medium ${
                          service.isActive === 1
                            ? "bg-green-50 text-green-600"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {service.isActive === 1 ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    {service.description && (
                      <p className="mt-1 text-sm text-gray-500">
                        {service.description}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => startEdit(service)}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleToggleActive(service)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        service.isActive === 1
                          ? "bg-red-50 text-red-600 hover:bg-red-100"
                          : "bg-green-50 text-green-600 hover:bg-green-100"
                      }`}
                    >
                      {service.isActive === 1 ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  ${service.price.toFixed(2)} · {service.durationMins} min
                </p>
              </div>
            )}
          </div>
        ))}
        {services.length === 0 && !loading && (
          <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
            <p className="text-gray-400">No hay servicios todavía</p>
          </div>
        )}
      </div>
    </div>
  );
}