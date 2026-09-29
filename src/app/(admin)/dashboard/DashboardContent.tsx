"use client";

import { useState, useEffect, useCallback } from "react";
import { AppointmentCard } from "@/components/AppointmentCard";
import { ClientCRMPanel } from "@/components/ClientCRMPanel";
import { ReschedulePicker } from "@/components/ReschedulePicker";
import { CompleteAppointmentDialog } from "@/components/CompleteAppointmentDialog";
import { NewAppointmentDialog } from "@/components/NewAppointmentDialog";
import { CourseSessionDialog } from "@/components/CourseSessionDialog";
import { BlockoutDialog } from "@/components/BlockoutDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AddServiceDialog } from "@/components/AddServiceDialog";
import { CompletedAppointmentDialog } from "@/components/CompletedAppointmentDialog";
import { PhotoLightbox, usePhotoLightbox, type LightboxPhoto } from "@/components/PhotoLightbox";
import { PhotoThumb } from "@/components/PhotoThumb";
import { dateToDayStartTs } from "@/lib/time";

type Appointment = {
  id: string;
  startTime: number;
  endTime: number;
  status: string;
  referencePhotoUrl: string | null;
  clientName: string;
  clientId: string;
  clientPhone: string | null;
  serviceName: string;
  serviceId: string;
  servicePrice: number | null;
  isGroup: number;
  studentCount: number;
  isOverdue?: number;
};

type Blockout = { id: string; startTime: number; endTime: number; reason: string | null };

type WaitlistEntry = {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  preferredDate: number;
  notified: number;
  createdAt: number | null;
};

type Props = {
  today: string;
};

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function datesOfWeek(from: Date): Date[] {
  const day = from.getDay(); // 0=Dom
  const monday = new Date(from);
  monday.setDate(from.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function DashboardContent({ today }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [view, setView] = useState<"day" | "week" | "waitlist" | "cancelled" | "summary" | "pending">("day");
  const [mounted, setMounted] = useState(false);
  const [weekDates, setWeekDates] = useState<Date[]>(() =>
    datesOfWeek(new Date())
  );
  const [weekData, setWeekData] = useState<Record<string, Appointment[]>>({});
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);
  const [completing, setCompleting] = useState<Appointment | null>(null);
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const [cancellingBusy, setCancellingBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [showCourseSession, setShowCourseSession] = useState(false);
  const [showBlockout, setShowBlockout] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
  const [viewingCompleted, setViewingCompleted] = useState<Appointment | null>(null);
  const [blockouts, setBlockouts] = useState<Blockout[]>([]);
  const [weekBlockouts, setWeekBlockouts] = useState<Record<string, Blockout[]>>({});
  const [cancelledList, setCancelledList] = useState<
    {
      id: string;
      clientId: string;
      serviceName: string;
      servicePrice: number;
      startTime: number | null;
      cancelledBy: string;
      cancelledAt: number;
      clientName: string;
      actorRole: string;
      referencePhotoUrls: string[];
    }[]
  >([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [summaryList, setSummaryList] = useState<Appointment[]>([]);
  const [summaryTotalRevenue, setSummaryTotalRevenue] = useState(0);
  const [pendingList, setPendingList] = useState<Appointment[]>([]);
  const lightbox = usePhotoLightbox();

  // Cada `AppointmentCard` solo tiene una foto de referencia: se abre sola.
  const openPhoto = (photo: LightboxPhoto) => lightbox.open([photo], 0);

  const fetchAppointments = useCallback(async () => {
    const res = await fetch(`/api/appointments?date=${today}`);
    const data = await res.json();
    setAppointments(data);
  }, [today]);

  const fetchBlockouts = useCallback(async () => {
    const from = dateToDayStartTs(today);
    const res = await fetch(`/api/blockouts?from=${from}&to=${from + 86400}`);
    const data = await res.json();
    setBlockouts(Array.isArray(data) ? data : []);
  }, [today]);

  const fetchCancelled = useCallback(async () => {
    const res = await fetch("/api/appointments/cancelled");
    const data = await res.json();
    setCancelledList(Array.isArray(data) ? data : []);
  }, []);

  const fetchWaitlist = useCallback(async () => {
    const res = await fetch("/api/waitlist");
    if (res.ok) {
      const data = await res.json();
      setWaitlist(Array.isArray(data) ? data : []);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    const res = await fetch("/api/appointments?all=1");
    const data = await res.json();
    if (res.ok) {
      setSummaryList(Array.isArray(data) ? data : []);
      setSummaryTotalRevenue(Array.isArray(data) ? data.reduce((sum: number, appt: Appointment) => sum + (appt.servicePrice || 0), 0) : 0);
    }
  }, []);

  const fetchPending = useCallback(async () => {
    const res = await fetch("/api/appointments?pendingOnly=1");
    if (res.ok) {
      const data = await res.json();
      setPendingList(Array.isArray(data) ? data : []);
    } else {
      setPendingList([]);
    }
  }, []);

  useEffect(() => {
    if (view === "summary") {
      fetchSummary();
    }
    if (view === "pending") {
      fetchPending();
    }
  }, [view, fetchSummary, fetchPending]);

  useEffect(() => {
    setMounted(true);
    fetchAppointments();
    fetchBlockouts();
    fetchCancelled();
    fetchWaitlist();
    fetchPending();
  }, [fetchAppointments, fetchBlockouts, fetchCancelled, fetchWaitlist, fetchPending]);

  useEffect(() => {
    const handler = () => {
      fetchAppointments();
      fetchPending();
    };
    window.addEventListener("appointments:refresh", handler);
    return () => window.removeEventListener("appointments:refresh", handler);
  }, [fetchAppointments, fetchPending]);

  const fetchWeek = useCallback(async (dates: Date[]) => {
    const entries: Record<string, Appointment[]> = {};
    const blockEntries: Record<string, Blockout[]> = {};
    for (const d of dates) {
      const date = fmtDate(d);
      const res = await fetch(`/api/appointments?date=${date}`);
      const data = await res.json();
      entries[date] = data;
      const from = dateToDayStartTs(date);
      const resB = await fetch(`/api/blockouts?from=${from}&to=${from + 86400}`);
      const dataB = await resB.json();
      blockEntries[date] = Array.isArray(dataB) ? dataB : [];
    }
    setWeekData(entries);
    setWeekBlockouts(blockEntries);
  }, []);

  useEffect(() => {
    if (view === "week") fetchWeek(weekDates);
  }, [view, weekDates, fetchWeek]);

  function shiftWeek(delta: number) {
    const base = new Date(weekDates[0]);
    base.setDate(base.getDate() + delta * 7);
    const next = datesOfWeek(base);
    setWeekDates(next);
  }

  function handleComplete(appt: Appointment) {
    setCompleting(appt);
  }

  async function handleCancel(id: string) {
    setCancellingBusy(true);
    setCancelError(null);
    const res = await fetch(`/api/appointments/${id}`, { method: "DELETE" });
    setCancellingBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setCancelError(data.error || "No se pudo cancelar la cita");
      return;
    }
    setCancelling(null);
    refreshAll();
  }

  function refreshAll() {
    fetchAppointments();
    fetchBlockouts();
    fetchCancelled();
    fetchPending();
    if (view === "week") fetchWeek(weekDates);
    if (view === "summary") fetchSummary();
  }

  function handleSelectAppointment(appt: Appointment) {
    setSelectedClientId(appt.clientId);
    setSelectedAppointment(appt);
  }

  const dateStr = (ts: number) =>
    new Intl.DateTimeFormat("es-ES", {
      dateStyle: "long",
      timeZone: "America/Caracas",
    }).format(new Date(ts * 1000));

  const timeStr = (ts: number) =>
    new Intl.DateTimeFormat("es-ES", {
      timeStyle: "short",
      timeZone: "America/Caracas",
    }).format(new Date(ts * 1000));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
        <p className="text-sm text-gray-500">
          {new Intl.DateTimeFormat("es-ES", {
            dateStyle: "full",
            timeZone: "America/Caracas",
          }).format(new Date())}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setShowNewAppointment(true)}
          className="rounded-xl bg-pink-main px-4 py-2 text-sm font-medium text-gray-900 hover:bg-pink-light transition-colors"
        >
          + Nueva cita
        </button>
        <button
          onClick={() => setShowCourseSession(true)}
          className="rounded-xl border border-pink-main bg-white px-4 py-2 text-sm font-medium text-pink-700 hover:bg-pink-light transition-colors"
        >
          + Nueva sesión de curso
        </button>
        <button
          onClick={() => setShowBlockout(true)}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          ⛔ Bloquear tiempo
        </button>
        <button
          onClick={() => setShowAddService(true)}
          className="rounded-xl bg-pink-100 px-3 py-1.5 text-sm font-medium text-pink-700 hover:bg-pink-200"
        >
          + Servicio realizado
        </button>
      </div>

      <div className="mb-4 inline-flex flex-wrap rounded-xl border border-gray-200 bg-white p-1">
        {(() => {
          const overdue = mounted ? pendingList.filter((a) => a.isOverdue === 1).length : 0;
          const total = mounted ? pendingList.length : 0;
          return (["day", "week", "summary", "pending", "waitlist", "cancelled"] as const).map(
            (v) => {
              const isPendingTab = v === "pending";
              const hasOverdue = isPendingTab && overdue > 0;
              return (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                    view === v
                      ? hasOverdue
                        ? "bg-red-100 text-red-700"
                        : "bg-pink-main text-gray-900"
                      : hasOverdue
                        ? "text-red-600 hover:bg-red-50"
                        : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {v === "day"
                    ? "Día"
                    : v === "week"
                      ? "Semana"
                      : v === "summary"
                        ? "Resumen"
                        : isPendingTab
                          ? (() => {
                              if (overdue > 0) {
                                return `Pendientes (${overdue} vencidas / ${total})`;
                              }
                              return total > 0
                                ? `Pendientes (${total})`
                                : "Pendientes";
                            })()
                          : v === "waitlist"
                            ? `Espera${mounted && waitlist.length > 0 ? ` (${waitlist.length})` : ""}`
                            : "Canceladas"}
                </button>
              );
            }
          );
        })()}
      </div>

      {view === "day" && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-gray-500">
            {new Intl.DateTimeFormat("es-ES", {
              dateStyle: "full",
              timeZone: "America/Caracas",
            }).format(new Date())}
          </h2>
          {blockouts.length > 0 && (
            <div className="mb-4 space-y-2">
              {blockouts.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-xl border border-dashed border-gray-300 bg-gray-100 px-4 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      ⛔ {timeStr(b.startTime)} — {timeStr(b.endTime)}
                    </p>
                    {b.reason && <p className="text-xs text-gray-500">{b.reason}</p>}
                  </div>
                  <button
                    onClick={async () => {
                      await fetch(`/api/blockouts/${b.id}`, { method: "DELETE" });
                      refreshAll();
                    }}
                    className="rounded-lg bg-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-300"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
          {appointments.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
              <p className="text-gray-400">No hay citas para hoy</p>
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.map((appt) => (
                <AppointmentCard
                  key={appt.id}
                  id={appt.id}
                  startTime={appt.startTime}
                  clientName={appt.clientName}
                  clientId={appt.clientId}
                  serviceName={appt.serviceName}
                  referencePhotoUrl={appt.referencePhotoUrl}
                  status={appt.status}
                  isGroup={appt.isGroup === 1}
                  studentCount={appt.studentCount}
                  onComplete={() => handleComplete(appt)}
                  onCancel={() => setCancelling(appt)}
                  onSelect={() => handleSelectAppointment(appt)}
                  onReschedule={() => setRescheduling(appt)}
                  onViewCompleted={() => setViewingCompleted(appt)}
                  onOpenPhoto={openPhoto}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {view === "week" && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <button
              onClick={() => shiftWeek(-1)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              ← Semana previa
            </button>
            <span className="text-sm font-medium text-gray-700">
              {fmtDate(weekDates[0])} —{" "}
              {fmtDate(weekDates[weekDates.length - 1])}
            </span>
            <button
              onClick={() => shiftWeek(1)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              Semana siguiente →
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {weekDates.map((d) => {
              const date = fmtDate(d);
              const dayAppts = weekData[date] || [];
              const isToday = date === today;
              return (
                <div
                  key={date}
                  className={`rounded-xl border p-3 ${
                    isToday ? "border-pink-main bg-pink-light/40" : "border-gray-200 bg-white"
                  }`}
                >
                  <p className="mb-2 text-xs font-semibold text-gray-500">
                    {WEEKDAYS[(d.getDay() + 6) % 7]}{" "}
                    {d.getDate()}{" "}
                    {isToday && (
                      <span className="ml-1 rounded bg-pink-main px-1 py-0.5 text-[10px] font-medium text-white">
                        Hoy
                      </span>
                    )}
                    {(weekBlockouts[date] ?? []).length > 0 && (
                      <span className="ml-1 rounded bg-gray-200 px-1 py-0.5 text-[10px] font-medium text-gray-500">
                        ⛔
                      </span>
                    )}
                  </p>
                  {dayAppts.length === 0 ? (
                    <p className="text-xs text-gray-300">Sin citas</p>
                  ) : (
                    <div className="space-y-2">
                      {dayAppts.map((appt) => (
                        <div
                          key={appt.id}
                          className="rounded-lg bg-gray-50 p-2"
                        >
                          <p className="text-xs font-medium text-gray-900">
                            {timeStr(appt.startTime)} · {appt.clientName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {appt.serviceName}
                          </p>
                          <div className="mt-1.5 flex gap-1">
                            <button
                              onClick={() => setRescheduling(appt)}
                              className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-100"
                            >
                              Reprogramar
                            </button>
                            <button
                              onClick={() => handleSelectAppointment(appt)}
                              className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-200"
                            >
                              Ver
                            </button>
                            {appt.status === "pending" || appt.status === "confirmed" ? (
                              <button
                                onClick={() => setCancelling(appt)}
                                className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600 hover:bg-red-100"
                              >
                                Cancelar
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "waitlist" && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-gray-500">
            Lista de espera (clientes que quieren un espacio si se libera)
          </h2>
          {waitlist.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
              <p className="text-gray-400">No hay clientes en lista de espera</p>
            </div>
          ) : (
            <div className="space-y-2">
              {waitlist.map((w) => (
                <div
                  key={w.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {w.clientName}{" "}
                      <span className="text-xs font-normal text-gray-400">
                        desde{" "}
                        {w.createdAt
                          ? new Intl.DateTimeFormat("es-ES", {
                              dateStyle: "short",
                              timeZone: "America/Caracas",
                            }).format(new Date(w.createdAt * 1000))
                          : "—"}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500">
                      Prefiere:{" "}
                      {new Intl.DateTimeFormat("es-ES", {
                        dateStyle: "full",
                        timeZone: "America/Caracas",
                      }).format(new Date(w.preferredDate * 1000))}
                      {" · "}
                      {w.clientPhone ?? "sin teléfono"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {w.notified === 1 && (
                      <span className="rounded-lg bg-green-50 px-2 py-1 text-xs font-medium text-green-600">
                        Notificado
                      </span>
                    )}
                    {w.clientPhone && (
                      <a
                        href={`https://wa.me/${w.clientPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                          `Hola ${w.clientName?.trim().split(/\s+/)[0] ?? ""}, se liberó un espacio en el salón. ¿Te interesa agendar para el ${new Intl.DateTimeFormat("es-ES", {
                            dateStyle: "long",
                            timeZone: "America/Caracas",
                          }).format(new Date(w.preferredDate * 1000))}?`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          if (w.notified !== 1) {
                            fetch(`/api/waitlist/${w.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ notified: true }),
                            })
                              .then(() => fetchWaitlist())
                              .catch(() => {});
                          }
                        }}
                        className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-100 transition-colors"
                      >
                        WhatsApp
                      </a>
                    )}
                    <button
                      onClick={async () => {
                        await fetch(`/api/waitlist/${w.id}`, { method: "DELETE" });
                        refreshAll();
                      }}
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "cancelled" && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-gray-500">
            Historial de citas canceladas
          </h2>
          {cancelledList.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
              <p className="text-gray-400">No hay citas canceladas</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Servicio</th>
                    <th className="px-4 py-3">Fotos</th>
                    <th className="px-4 py-3">Precio</th>
                    <th className="px-4 py-3">Canceló</th>
                    <th className="px-4 py-3">Cuándo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cancelledList.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3">
                        {c.startTime
                          ? new Intl.DateTimeFormat("es-ES", {
                              dateStyle: "medium",
                              timeStyle: "short",
                              timeZone: "America/Caracas",
                            }).format(new Date(c.startTime * 1000))
                          : "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {c.clientName}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{c.serviceName}</td>
                      <td className="px-4 py-3">
                        {c.referencePhotoUrls.length > 0 ? (
                          <PhotoThumb
                            photos={c.referencePhotoUrls.map((url, i) => ({
                              id: `${c.id}-ref-${i}`,
                              url,
                              caption: `Referencia · ${c.serviceName} · ${c.clientName}`,
                            }))}
                            index={0}
                            onOpen={lightbox.open}
                            width={40}
                            height={40}
                            className="h-10 w-10"
                          />
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">${c.servicePrice.toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {c.actorRole === "client" ? "Cliente" : "Admin"}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Intl.DateTimeFormat("es-ES", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "America/Caracas",
                        }).format(new Date(c.cancelledAt * 1000))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {view === "summary" && (
        <div>
          <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium uppercase text-gray-500">Ingresos estimados</p>
              <p className="mt-1 text-2xl font-bold text-pink-600">${summaryTotalRevenue.toFixed(2)}</p>
              <p className="mt-1 text-xs text-gray-400">Suma de precios de servicios</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium uppercase text-gray-500">Clientes pendientes</p>
              <p className="mt-1 text-2xl font-bold text-pink-600">{summaryList.length}</p>
              <p className="mt-1 text-xs text-gray-400">Citas activas</p>
            </div>
          </div>

          <h2 className="mb-3 text-sm font-medium text-gray-500">
            Todas las citas (próximas → lejanas)
          </h2>
          {summaryList.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
              <p className="text-gray-400">No hay citas registradas</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Servicio</th>
                    <th className="px-4 py-3">Costo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summaryList.map((appt) => (
                    <tr key={appt.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        {new Intl.DateTimeFormat("es-ES", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "America/Caracas",
                        }).format(new Date(appt.startTime * 1000))}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {appt.clientName}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{appt.serviceName}</td>
                      <td className="px-4 py-3 text-pink-600 font-medium">
                        ${(appt.servicePrice || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {view === "pending" && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-gray-500">
            Citas sin completar (últimos 60 días y próximos 30 días)
          </h2>
          {pendingList.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
              <p className="text-gray-400">No hay citas pendientes</p>
            </div>
          ) : (() => {
            const overdue = pendingList.filter((a) => a.isOverdue === 1);
            const upcoming = pendingList.filter((a) => a.isOverdue !== 1);
            const renderCard = (appt: Appointment) => (
              <AppointmentCard
                key={appt.id}
                id={appt.id}
                startTime={appt.startTime}
                clientName={appt.clientName}
                clientId={appt.clientId}
                serviceName={appt.serviceName}
                referencePhotoUrl={appt.referencePhotoUrl}
                status={appt.status}
                isGroup={appt.isGroup === 1}
                studentCount={appt.studentCount}
                onComplete={() => handleComplete(appt)}
                onCancel={() => setCancelling(appt)}
                onSelect={() => handleSelectAppointment(appt)}
                onReschedule={() => setRescheduling(appt)}
                onViewCompleted={() => setViewingCompleted(appt)}
                onOpenPhoto={openPhoto}
              />
            );
            return (
              <div className="space-y-6">
                {overdue.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="rounded-lg bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        Vencidas
                      </span>
                      <span className="text-xs text-gray-500">
                        {overdue.length} cita{overdue.length === 1 ? "" : "s"} sin completar de días anteriores
                      </span>
                    </div>
                    <div className="space-y-3">
                      {overdue.map(renderCard)}
                    </div>
                  </div>
                )}
                {upcoming.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="rounded-lg bg-pink-main px-2 py-0.5 text-xs font-semibold text-gray-900">
                        Hoy y próximas
                      </span>
                      <span className="text-xs text-gray-500">
                        {upcoming.length} cita{upcoming.length === 1 ? "" : "s"} pendientes
                      </span>
                    </div>
                    <div className="space-y-3">
                      {upcoming.map(renderCard)}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {rescheduling && (
        <ReschedulePicker
          appointmentId={rescheduling.id}
          serviceId={rescheduling.serviceId}
          currentStartTime={rescheduling.startTime}
          currentStatus={rescheduling.status}
          currentDate={dateStr(rescheduling.startTime)}
          currentTime={timeStr(rescheduling.startTime)}
          onClose={() => setRescheduling(null)}
          onRescheduled={refreshAll}
        />
      )}

      {cancelling && (
        <ConfirmDialog
          title="Cancelar cita"
          message={`¿Cancelar la cita de ${cancelling.clientName}? Se eliminará y quedará registrada en el historial de canceladas.`}
          confirmLabel="Cancelar cita"
          danger
          busy={cancellingBusy}
          error={cancelError}
          onConfirm={() => handleCancel(cancelling.id)}
          onClose={() => {
            setCancelling(null);
            setCancelError(null);
          }}
        />
      )}

      {selectedClientId && selectedAppointment && (
        <ClientCRMPanel
          clientId={selectedClientId}
          appointmentId={selectedAppointment.id}
          serviceName={selectedAppointment.serviceName}
          appointmentDate={dateStr(selectedAppointment.startTime)}
          appointmentTime={timeStr(selectedAppointment.startTime)}
          onClose={() => {
            setSelectedClientId(null);
            setSelectedAppointment(null);
          }}
          onDeleted={() => {
            setSelectedClientId(null);
            setSelectedAppointment(null);
            refreshAll();
          }}
          appointmentStatus={selectedAppointment.status}
          onChanged={refreshAll}
        />
      )}

      {completing && (
        <CompleteAppointmentDialog
          appointmentId={completing.id}
          clientId={completing.clientId}
          clientName={completing.clientName}
          serviceName={completing.serviceName}
          servicePrice={completing.servicePrice ?? 0}
          onClose={() => setCompleting(null)}
          onCompleted={() => {
            setCompleting(null);
            refreshAll();
          }}
        />
      )}

      {showNewAppointment && (
        <NewAppointmentDialog
          onClose={() => setShowNewAppointment(false)}
          onCreated={() => {
            setShowNewAppointment(false);
            refreshAll();
          }}
        />
      )}

      {showCourseSession && (
        <CourseSessionDialog
          open={showCourseSession}
          onOpenChange={setShowCourseSession}
          onCreated={() => {
            setShowCourseSession(false);
            refreshAll();
          }}
        />
      )}

      {showBlockout && (
        <BlockoutDialog
          onClose={() => setShowBlockout(false)}
          onCreated={() => {
            setShowBlockout(false);
            refreshAll();
          }}
        />
      )}

      {showAddService && (
        <AddServiceDialog
          onClose={() => setShowAddService(false)}
          onSaved={() => {
            setShowAddService(false);
            refreshAll();
          }}
        />
      )}

      {viewingCompleted && (
        <CompletedAppointmentDialog
          appointmentId={viewingCompleted.id}
          clientName={viewingCompleted.clientName}
          serviceName={viewingCompleted.serviceName}
          servicePrice={viewingCompleted.servicePrice ?? 0}
          dateStr={dateStr(viewingCompleted.startTime)}
          timeStr={timeStr(viewingCompleted.startTime)}
          onClose={() => setViewingCompleted(null)}
          onUpdated={refreshAll}
        />
      )}

      <PhotoLightbox {...lightbox} />
    </div>
  );
}