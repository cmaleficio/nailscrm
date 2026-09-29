"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { dateToDayStartTs, tsToLocalLabel } from "@/lib/time";
import { MAX_COMPLEMENTARY_SERVICES } from "@/lib/booking-combos";

type Service = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationMins: number;
  isComplementary: number;
  isGroup: number;
};

type Slot = {
  hour: number;
  minute: number;
  label: string;
  available: boolean;
};

type GalleryItem = {
  id: string;
  url: string;
  serviceName: string;
};

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function BookingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();

  const [step, setStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [complementaryIds, setComplementaryIds] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [maxContiguousMins, setMaxContiguousMins] = useState<number>(0);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [referencePreviews, setReferencePreviews] = useState<string[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [wlStatus, setWlStatus] = useState<"idle" | "joining" | "joined" | "already">("idle");
  const [wlError, setWlError] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return now.getMonth();
  });
  const [calendarYear, setCalendarYear] = useState(() => {
    const now = new Date();
    return now.getFullYear();
  });

  async function fetchServices() {
    const res = await fetch("/api/services");
    const data = await res.json();
    setServices(data);
  }

  const preselectedService = useCallback(async () => {
    const serviceId = searchParams.get("serviceId");
    if (serviceId) {
      const res = await fetch(`/api/services?id=${serviceId}`);
      const data = await res.json();
      // Un complementario nunca puede ser el principal (lo rechaza la API),
      // así que un enlace directo a uno se ignora en vez de fallar al confirmar.
      if (data && data.isComplementary !== 1) {
        setSelectedService(data);
        setStep(2);
      }
    }
    const referencePhotoUrl = searchParams.get("referencePhotoUrl");
    if (referencePhotoUrl) {
      setSelectedModels((prev) =>
        prev.includes(referencePhotoUrl) ? prev : [...prev, referencePhotoUrl]
      );
    }
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/gallery?limit=50")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.items)) setGallery(data.items);
      })
      .catch(() => {});
    void fetchServices();
    void preselectedService();
  }, [preselectedService]);

  const selectedComplementaries = services.filter((s) =>
    complementaryIds.includes(s.id)
  );

  const totalDurationMins =
    (selectedService?.durationMins ?? 0) +
    selectedComplementaries.reduce((acc, s) => acc + s.durationMins, 0);
  const totalPrice =
    (selectedService?.price ?? 0) +
    selectedComplementaries.reduce((acc, s) => acc + s.price, 0);

  // Si el hueco más largo del día no alcanza para la combinación, la respuesta
  // correcta es quitar servicios (no la lista de espera). maxContiguousMins es
  // 0 cuando el día está lleno, así que ese caso sí ofrece espera.
  const comboDoesNotFit = maxContiguousMins > 0 && maxContiguousMins < totalDurationMins;

  // El principal es opcional: si solo hay complementarios, /api/appointments
  // sigue exigiendo serviceId, así que en ese caso se ancla con el primero.
  const primaryService = selectedService ?? selectedComplementaries[0] ?? null;

  const principalServices = services.filter((s) => s.isComplementary !== 1);
  const complementaryServices = services.filter((s) => s.isComplementary === 1);
  const selectedCount = selectedComplementaries.length + (selectedService ? 1 : 0);

  function toggleComplementary(id: string) {
    const alreadyOn = complementaryIds.includes(id);
    // El principal no puede repetirse como complementario, y un curso no se
    // combina: son las dos reglas que el backend vuelve a validar en el POST.
    if (!alreadyOn) {
      if (complementaryIds.length >= MAX_COMPLEMENTARY_SERVICES) return;
      const service = services.find((s) => s.id === id);
      if (!service || service.isComplementary !== 1 || service.isGroup) return;
      if (selectedService && selectedService.id === id) return;
    }
    const next = alreadyOn
      ? complementaryIds.filter((x) => x !== id)
      : [...complementaryIds, id];
    setComplementaryIds(next);
    // La duración cambia, así que el slot elegido puede dejar de servir y la
    // lista de slots que ya está en pantalla quedó calculada para otra
    // combinación: hay que recargar si el usuario ya había elegido fecha.
    setSelectedSlot(null);
    if (selectedDate) void fetchSlots(selectedDate, next);
  }

  function choosePrimary(service: Service) {
    setSelectedService(service);
    const next = complementaryIds.filter((id) => id !== service.id);
    setComplementaryIds(next);
    setSelectedSlot(null);
    if (selectedDate) void fetchSlots(selectedDate, next);
  }

  // Sin useCallback a propósito: primaryService se deriva de los servicios
  // cargados, y el compilador de React no puede preservar la memoización
  // manual con una dependencia derivada (react-hooks/preserve-manual-memoization).
  // Los ids se reciben por parámetro y no del closure para que quien llama,
  // que los acaba de calcular, no mande la lista anterior.
  const fetchSlots = async (date: string, ids: string[] = complementaryIds) => {
    if (!primaryService) return;
    setLoadingSlots(true);
    const extras = ids
      .filter((id) => id !== primaryService.id)
      .map((id) => `addServiceIds=${encodeURIComponent(id)}`)
      .join("&");
    const res = await fetch(
      `/api/slots?date=${date}&serviceId=${primaryService.id}${extras ? `&${extras}` : ""}`
    );
    const data = await res.json();
    setSlots(data.slots || []);
    setMaxContiguousMins(data.maxContiguousMins ?? 0);
    setLoadingSlots(false);
  };

  function handleDateSelect(date: string) {
    setSelectedDate(date);
    setSelectedSlot(null);
    setWlStatus("idle");
    setWlError("");
    void fetchSlots(date);
  }

  async function handleJoinWaitlist() {
    if (!selectedDate) return;
    const dayStart = dateToDayStartTs(selectedDate);
    setWlStatus("joining");
    setWlError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredDate: dayStart }),
      });
      if (res.status === 409) {
        setWlStatus("already");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo unir a la lista de espera");
      }
      setWlStatus("joined");
    } catch (e) {
      setWlStatus("idle");
      setWlError(e instanceof Error ? e.message : "Error inesperado");
    }
  }

  function handleSlotSelect(hour: number, minute: number) {
    if (!selectedDate) return;
    const dayStart = dateToDayStartTs(selectedDate);
    const timestamp = dayStart + hour * 3600 + minute * 60;
    setSelectedSlot(timestamp);
  }

  function toggleModel(url: string) {
    setSelectedModels((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    );
  }

  async function handleConfirm() {
    if (!primaryService || !selectedSlot || status !== "authenticated") return;

    setSubmitting(true);
    setSubmitError("");

    try {
      const referencePhotoUrls: string[] = [];

      for (const file of referenceFiles) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) {
          throw new Error("No se pudo subir la foto de referencia.");
        }
        const uploadData = await uploadRes.json();
        referencePhotoUrls.push(uploadData.url);
      }

      const urlsToSend = [...referencePhotoUrls, ...selectedModels];

      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: primaryService.id,
          addServiceIds: complementaryIds.filter(
            (id) => id !== primaryService.id
          ),
          startTime: selectedSlot,
          referencePhotoUrl: urlsToSend[0] || "",
          referencePhotoUrls: urlsToSend,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo crear la reserva.");
      }

      router.push("/success");
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "Ocurrió un error al reservar."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const today = new Date();
  const firstDay = new Date(calendarYear, calendarMonth, 1);
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const startDay = firstDay.getDay();

  function prevMonth() {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  }

  function isPastDate(day: number) {
    if (calendarYear < today.getFullYear()) return true;
    if (calendarYear > today.getFullYear()) return false;
    if (calendarMonth < today.getMonth()) return true;
    if (calendarMonth > today.getMonth()) return false;
    return day <= today.getDate();
  }

  if (status === "unauthenticated") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Inicia sesión para reservar</h1>
        <p className="mt-2 text-gray-500">
          Necesitas iniciar sesión para agendar una cita.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            onClick={() => signInGoogle()}
            className="w-full rounded-xl bg-pink-main px-6 py-3 text-sm font-medium hover:bg-pink-light transition-colors"
          >
            Iniciar sesión con Google
          </button>
          <Link
            href="/login"
            className="w-full rounded-xl border border-gray-200 px-6 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Entrar o crear cuenta con correo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      {/* Progress */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                step >= s
                  ? "bg-pink-main text-gray-900"
                  : "bg-gray-soft text-gray-400"
              }`}
            >
              {s}
            </div>
            {s < 3 && (
              <div
                className={`h-0.5 w-8 ${
                  step > s ? "bg-pink-main" : "bg-gray-soft"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">
            Elige tu servicio
          </h2>
          <p className="mb-6 text-sm text-gray-500">
            Puedes agregar hasta {MAX_COMPLEMENTARY_SERVICES} servicios
            complementarios en la misma cita. Se reservan corridos y suman su
            precio y su duración.
          </p>

          <div className="space-y-3">
            {principalServices.map((s) => {
              const chosen = selectedService?.id === s.id;
              return (
                <div
                  key={s.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    chosen ? "border-pink-main bg-pink-light" : "border-gray-200 bg-white"
                  }`}
                >
                  <button
                    onClick={() => {
                      choosePrimary(s);
                      setStep(2);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="font-medium text-gray-900">{s.name}</p>
                    {s.description && (
                      <p className="mt-0.5 text-sm text-gray-500">
                        {s.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      {s.durationMins} min · ${s.price.toFixed(2)}
                    </p>
                  </button>
                </div>
              );
            })}
          </div>

          {complementaryServices.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-1 text-sm font-semibold text-gray-900">
                ¿Quieres agregar algo más?
              </h3>
              <p className="mb-3 text-xs text-gray-500">
                Servicios complementarios: se suman a la misma cita y también
                aparecen en tu cuenta.
              </p>
              <div className="space-y-2">
                {complementaryServices.map((s) => {
                  const on = complementaryIds.includes(s.id);
                  const full =
                    !on && complementaryIds.length >= MAX_COMPLEMENTARY_SERVICES;
                  return (
                    <div
                      key={s.id}
                      className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors ${
                        on ? "border-purple-200 bg-purple-50" : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {s.name}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          +${s.price.toFixed(2)} · +{s.durationMins} min
                        </p>
                      </div>
                      <button
                        onClick={() => toggleComplementary(s.id)}
                        disabled={full}
                        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          on
                            ? "bg-purple-100 text-purple-700"
                            : full
                              ? "cursor-not-allowed bg-gray-100 text-gray-300"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {on ? "Agregado ✓" : "+ Agregar"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(selectedService || complementaryIds.length > 0) && (
            <div className="mt-4 rounded-xl border border-purple-100 bg-purple-50/50 p-4">
              <p className="mb-2 text-sm font-medium text-gray-900">
                Tu cita ({selectedCount} {selectedCount === 1 ? "servicio" : "servicios"})
              </p>
              <ul className="mb-3 space-y-1 text-sm text-gray-600">
                {selectedService && (
                  <li className="flex items-center justify-between">
                    <span>{selectedService.name}</span>
                    <span className="text-gray-400">
                      ${selectedService.price.toFixed(2)} · {selectedService.durationMins} min
                    </span>
                  </li>
                )}
                {selectedComplementaries.map((s) => (
                  <li key={s.id} className="flex items-center justify-between">
                    <span className="text-purple-700">+ {s.name}</span>
                    <span className="text-gray-400">
                      ${s.price.toFixed(2)} · {s.durationMins} min
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t border-purple-100 pt-3 text-sm">
                <span className="text-gray-500">Total</span>
                <span className="font-semibold text-gray-900">
                  ${totalPrice.toFixed(2)} · {totalDurationMins} min
                </span>
              </div>
            </div>
          )}

          <button
            onClick={() => setStep(2)}
            disabled={!primaryService}
            className="mt-6 w-full rounded-xl bg-pink-main px-6 py-2.5 text-sm font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50 transition-colors"
          >
            Continuar
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="mb-6 text-xl font-semibold text-gray-900">
            Elige fecha y hora
          </h2>

          {/* Calendar */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={prevMonth}
                className="rounded-lg p-2 hover:bg-gray-100"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="font-medium text-gray-900">
                {MONTHS[calendarMonth]} {calendarYear}
              </span>
              <button
                onClick={nextMonth}
                className="rounded-lg p-2 hover:bg-gray-100"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-1">
              {Array.from({ length: startDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const past = isPastDate(day);
                const selected = selectedDate === dateStr;

                return (
                  <button
                    key={day}
                    disabled={past}
                    onClick={() => handleDateSelect(dateStr)}
                    className={`rounded-lg py-2 text-sm transition-colors ${
                      selected
                        ? "bg-pink-main text-gray-900 font-medium"
                        : past
                          ? "text-gray-300 cursor-not-allowed"
                          : "text-gray-700 hover:bg-pink-light"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slots */}
          {selectedDate && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-medium text-gray-700">
                Horarios disponibles
              </h3>
              {loadingSlots ? (
                <p className="text-sm text-gray-400">Cargando horarios...</p>
              ) : slots.length === 0 || !slots.some((s) => s.available) ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center">
                  <p className="text-sm text-gray-500">
                    No hay horarios disponibles para este día
                  </p>
                  {/*
                    Si cabe un servicio suelto pero no la combinación, la espera
                    NO ayuda: quitar un servicio es lo que desbloquea el día. Por
                    eso la lista de espera solo aparece cuando el día está lleno
                    de verdad, y el nombre del servicio tampoco se elige todavía
                    (la espera es por día).
                  */}
                  {comboDoesNotFit ? (
                    <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-left">
                      <p className="text-sm text-amber-800">
                        Tu combinación de {totalDurationMins} min no cabe en
                        este día: el espacio más largo libre es de{" "}
                        {maxContiguousMins} min.
                      </p>
                      <button
                        onClick={() => setStep(1)}
                        className="mt-2 w-full rounded-xl bg-pink-main px-4 py-2 text-sm font-medium text-gray-900 hover:bg-pink-light transition-colors"
                      >
                        Quitar o cambiar servicios
                      </button>
                    </div>
                  ) : wlStatus === "joined" || wlStatus === "already" ? (
                    <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                      {wlStatus === "already"
                        ? "Ya estás en la lista de espera para este día. Te avisaremos si se libera un espacio."
                        : "¡Listo! Te avisaremos por WhatsApp si se libera un espacio."}
                    </p>
                  ) : (
                    <>
                      <button
                        onClick={handleJoinWaitlist}
                        disabled={wlStatus === "joining"}
                        className="mt-3 rounded-xl bg-pink-main px-5 py-2 text-sm font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50 transition-colors"
                      >
                        {wlStatus === "joining"
                          ? "Uniéndote..."
                          : "Unirme a la lista de espera"}
                      </button>
                      {wlError && (
                        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                          {wlError}
                        </p>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((slot) => {
                    const slotTs =
                      dateToDayStartTs(selectedDate) +
                      slot.hour * 3600 +
                      slot.minute * 60;
                    return (
                      <button
                        key={slot.label}
                        disabled={!slot.available}
                        onClick={() => handleSlotSelect(slot.hour, slot.minute)}
                        className={`rounded-lg py-2.5 text-sm transition-colors ${
                          selectedSlot === slotTs
                            ? "bg-pink-main text-gray-900 font-medium"
                            : slot.available
                              ? "bg-white border border-gray-200 text-gray-700 hover:border-pink-main"
                              : "bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-100"
                        }`}
                      >
                        {slot.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="mt-8 flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="rounded-xl border border-gray-200 px-6 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Atrás
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!selectedSlot || comboDoesNotFit}
              className="flex-1 rounded-xl bg-pink-main px-6 py-2.5 text-sm font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50 transition-colors"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {step === 3 && primaryService && (
        <div>
          <h2 className="mb-6 text-xl font-semibold text-gray-900">
            Confirma tu reserva
          </h2>

          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex justify-between gap-4">
              <span className="text-sm text-gray-500">
                {selectedComplementaries.length > 0 ? "Servicios" : "Servicio"}
              </span>
              <span className="text-right text-sm font-medium text-gray-900">
                {selectedComplementaries.length > 0 ? (
                  <>
                    {selectedService && <div>{selectedService.name}</div>}
                    {selectedComplementaries.map((s) => (
                      <div key={s.id} className="text-purple-700">
                        + {s.name}
                      </div>
                    ))}
                  </>
                ) : (
                  primaryService.name
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Precio</span>
              <span className="text-sm font-medium text-gray-900">
                ${totalPrice.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Duración</span>
              <span className="text-sm font-medium text-gray-900">
                {totalDurationMins} min
              </span>
            </div>
            {selectedSlot && (
              <>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Fecha y hora</span>
                  <span className="text-sm font-medium text-gray-900">
                    {tsToLocalLabel(selectedSlot)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Photo upload */}
          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Fotos de referencia (opcional)
            </label>
            <div className="flex items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Subir fotos
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length > 0) {
                      setReferenceFiles((prev) => [...prev, ...files]);
                      setReferencePreviews((prev) => [
                        ...prev,
                        ...files.map((f) => URL.createObjectURL(f)),
                      ]);
                    }
                    e.target.value = "";
                  }}
                />
              </label>
              {referencePreviews.length > 0 && (
                <span className="text-sm text-gray-500">
                  {referencePreviews.length} foto{referencePreviews.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            {referencePreviews.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {referencePreviews.map((preview, i) => (
                  <div key={preview} className="relative">
                    <Image
                      src={preview}
                      alt={`Preview ${i + 1}`}
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setReferencePreviews((prev) => prev.filter((_, idx) => idx !== i));
                        setReferenceFiles((prev) => prev.filter((_, idx) => idx !== i));
                      }}
                      className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-xs text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modelos de inspiración */}
          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Elige modelos del muro de inspiración (opcional)
            </label>
            {gallery.length === 0 ? (
              <p className="text-sm text-gray-400">
                Aún no hay modelos en el muro de inspiración
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {gallery.map((g) => {
                  const selected = selectedModels.includes(g.url);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleModel(g.url)}
                      className={`relative aspect-square overflow-hidden rounded-xl border-2 transition-all ${
                        selected ? "border-pink-main" : "border-transparent"
                      }`}
                    >
                      <Image
                        fill
                        sizes="(max-width: 640px) 33vw, 25vw"
                        src={g.url}
                        alt={g.serviceName}
                        className="object-cover"
                      />
                      {selected && (
                        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-main text-xs font-bold text-gray-900">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {selectedModels.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-sm text-gray-500">
                  {selectedModels.length} modelo{selectedModels.length > 1 ? "s" : ""} seleccionado
                  {selectedModels.length > 1 ? "s" : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedModels.map((url) => (
                    <div key={url} className="relative">
                      <Image
                        src={url}
                        alt="Modelo"
                        width={64}
                        height={64}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => toggleModel(url)}
                        className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-xs text-white"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {submitError && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {submitError}
            </p>
          )}

          <div className="mt-8 flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="rounded-xl border border-gray-200 px-6 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Atrás
            </button>
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="flex-1 rounded-xl bg-pink-main px-6 py-2.5 text-sm font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50 transition-colors"
            >
              {submitting ? "Reservando..." : "Confirmar reserva"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function signInGoogle() {
  const callbackUrl =
    window.location.pathname + window.location.search || "/book";
  void signIn("google", { callbackUrl });
}
