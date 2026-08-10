"use client";

import { useState, useEffect, useCallback } from "react";
import { AppointmentCard } from "@/components/AppointmentCard";
import { ClientCRMPanel } from "@/components/ClientCRMPanel";
import { ReschedulePicker } from "@/components/ReschedulePicker";
import { CompleteAppointmentDialog } from "@/components/CompleteAppointmentDialog";
import { NewAppointmentDialog } from "@/components/NewAppointmentDialog";
import { BlockoutDialog } from "@/components/BlockoutDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
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
};

type Blockout = { id: string; startTime: number; endTime: number; reason: string | null };

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
  const [view, setView] = useState<"day" | "week" | "cancelled">("day");
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
  const [showBlockout, setShowBlockout] = useState(false);
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
    }[]
  >([]);

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

  useEffect(() => {
    fetchAppointments();
    fetchBlockouts();
    fetchCancelled();
  }, [fetchAppointments, fetchBlockouts, fetchCancelled]);

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
    if (view === "week") fetchWeek(weekDates);
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
          onClick={() => setShowBlockout(true)}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          ⛔ Bloquear tiempo
        </button>
      </div>

      <div className="mb-4 inline-flex rounded-xl border border-gray-200 bg-white p-1">
        {(["day", "week", "cancelled"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              view === v
                ? "bg-pink-main text-gray-900"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {v === "day" ? "Día" : v === "week" ? "Semana" : "Canceladas"}
          </button>
        ))}
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
                  onComplete={() => handleComplete(appt)}
                  onCancel={() => setCancelling(appt)}
                  onSelect={() => handleSelectAppointment(appt)}
                  onReschedule={() => setRescheduling(appt)}
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

      {showBlockout && (
        <BlockoutDialog
          onClose={() => setShowBlockout(false)}
          onCreated={() => {
            setShowBlockout(false);
            refreshAll();
          }}
        />
      )}
    </div>
  );
}