"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

type Service = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationMins: number;
};

type Slot = {
  hour: number;
  minute: number;
  label: string;
  available: boolean;
};

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function BookingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const [step, setStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return now.getMonth();
  });
  const [calendarYear, setCalendarYear] = useState(() => {
    const now = new Date();
    return now.getFullYear();
  });

  useEffect(() => {
    fetch("/api/gallery?limit=100")
      .then((r) => r.json())
      .catch(() => {});
    fetchServices();
    preselectedService();
  }, []);

  async function fetchServices() {
    const res = await fetch("/api/services");
    const data = await res.json();
    setServices(data);
  }

  async function preselectedService() {
    const serviceId = searchParams.get("serviceId");
    if (serviceId) {
      const res = await fetch(`/api/services?id=${serviceId}`);
      const data = await res.json();
      if (data) {
        setSelectedService(data);
        setStep(2);
      }
    }
  }

  const fetchSlots = useCallback(async (date: string) => {
    if (!selectedService) return;
    setLoadingSlots(true);
    const res = await fetch(
      `/api/slots?date=${date}&serviceId=${selectedService.id}`
    );
    const data = await res.json();
    setSlots(data.slots || []);
    setLoadingSlots(false);
  }, [selectedService]);

  function handleDateSelect(date: string) {
    setSelectedDate(date);
    setSelectedSlot(null);
    fetchSlots(date);
  }

  function handleSlotSelect(hour: number) {
    if (!selectedDate) return;
    const dateObj = new Date(selectedDate + "T00:00:00-04:00");
    const timestamp = Math.floor(dateObj.getTime() / 1000) + hour * 3600;
    setSelectedSlot(timestamp);
  }

  async function handleConfirm() {
    if (!selectedService || !selectedSlot || status !== "authenticated") return;

    setSubmitting(true);

    let referencePhotoUrl = "";

    if (referenceFile) {
      const formData = new FormData();
      formData.append("file", referenceFile);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();
      referencePhotoUrl = uploadData.url;
    }

    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: selectedService.id,
        startTime: selectedSlot,
        referencePhotoUrl,
      }),
    });

    if (res.ok) {
      router.push("/success");
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
          Necesitas iniciar sesión con Google para agendar una cita.
        </p>
        <button
          onClick={() => signInGoogle()}
          className="mt-6 rounded-xl bg-pink-main px-6 py-3 text-sm font-medium hover:bg-pink-light transition-colors"
        >
          Iniciar sesión con Google
        </button>
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
          <h2 className="mb-6 text-xl font-semibold text-gray-900">
            Elige tu servicio
          </h2>
          <div className="space-y-3">
            {services.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setSelectedService(s);
                  setStep(2);
                }}
                className={`w-full rounded-xl border p-4 text-left transition-colors hover:border-pink-main ${
                  selectedService?.id === s.id
                    ? "border-pink-main bg-pink-light"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{s.name}</p>
                    {s.description && (
                      <p className="mt-0.5 text-sm text-gray-500">
                        {s.description}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      ${s.price.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-500">{s.durationMins} min</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
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
              ) : slots.length === 0 ? (
                <p className="text-sm text-gray-400">
                  No hay horarios disponibles para este día
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((slot) => (
                    <button
                      key={slot.label}
                      disabled={!slot.available}
                      onClick={() => handleSlotSelect(slot.hour)}
                      className={`rounded-lg py-2.5 text-sm transition-colors ${
                        selectedSlot ===
                        Math.floor(new Date(selectedDate + "T00:00:00-04:00").getTime() / 1000) +
                          slot.hour * 3600
                          ? "bg-pink-main text-gray-900 font-medium"
                          : slot.available
                            ? "bg-white border border-gray-200 text-gray-700 hover:border-pink-main"
                            : "bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-100"
                      }`}
                    >
                      {slot.label}
                    </button>
                  ))}
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
              disabled={!selectedSlot}
              className="flex-1 rounded-xl bg-pink-main px-6 py-2.5 text-sm font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50 transition-colors"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {step === 3 && selectedService && (
        <div>
          <h2 className="mb-6 text-xl font-semibold text-gray-900">
            Confirma tu reserva
          </h2>

          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Servicio</span>
              <span className="text-sm font-medium text-gray-900">
                {selectedService.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Precio</span>
              <span className="text-sm font-medium text-gray-900">
                ${selectedService.price.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Duración</span>
              <span className="text-sm font-medium text-gray-900">
                {selectedService.durationMins} min
              </span>
            </div>
            {selectedSlot && (
              <>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Fecha</span>
                  <span className="text-sm font-medium text-gray-900">
                    {new Intl.DateTimeFormat("es-ES", {
                      dateStyle: "long",
                      timeZone: "America/Caracas",
                    }).format(new Date(selectedSlot * 1000))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Hora</span>
                  <span className="text-sm font-medium text-gray-900">
                    {new Intl.DateTimeFormat("es-ES", {
                      timeStyle: "short",
                      timeZone: "America/Caracas",
                    }).format(new Date(selectedSlot * 1000))}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Photo upload */}
          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Foto de referencia (opcional)
            </label>
            <div className="flex items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Subir foto
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setReferenceFile(file);
                      setReferencePreview(URL.createObjectURL(file));
                    }
                  }}
                />
              </label>
              {referencePreview && (
                <img
                  src={referencePreview}
                  alt="Preview"
                  className="h-16 w-16 rounded-lg object-cover"
                />
              )}
            </div>
          </div>

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
  window.location.href = "/api/auth/signin/google";
}
