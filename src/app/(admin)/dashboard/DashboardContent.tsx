"use client";

import { useState, useEffect, useCallback } from "react";
import { AppointmentCard } from "@/components/AppointmentCard";
import { ClientCRMPanel } from "@/components/ClientCRMPanel";
import { ReschedulePicker } from "@/components/ReschedulePicker";

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
  const [view, setView] = useState<"day" | "week">("day");
  const [weekDates, setWeekDates] = useState<Date[]>(() =>
    datesOfWeek(new Date())
  );
  const [weekData, setWeekData] = useState<Record<string, Appointment[]>>({});
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);

  const fetchAppointments = useCallback(async () => {
    const res = await fetch(`/api/appointments?date=${today}`);
    const data = await res.json();
    setAppointments(data);
  }, [today]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const fetchWeek = useCallback(async (dates: Date[]) => {
    const entries: Record<string, Appointment[]> = {};
    for (const d of dates) {
      const date = fmtDate(d);
      const res = await fetch(`/api/appointments?date=${date}`);
      const data = await res.json();
      entries[date] = data;
    }
    setWeekData(entries);
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

  async function handleComplete(id: string) {
    await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    refreshAll();
  }

  async function handleCancel(id: string) {
    await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    refreshAll();
  }

  function refreshAll() {
    fetchAppointments();
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

      <div className="mb-4 inline-flex rounded-xl border border-gray-200 bg-white p-1">
        {(["day", "week"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              view === v
                ? "bg-pink-main text-gray-900"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {v === "day" ? "Día" : "Semana"}
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
                  appointmentDate={dateStr(appt.startTime)}
                  appointmentTime={timeStr(appt.startTime)}
                  onComplete={handleComplete}
                  onCancel={handleCancel}
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
        />
      )}
    </div>
  );
}

function dateStr(ts: number) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "long",
    timeZone: "America/Caracas",
  }).format(new Date(ts * 1000));
}