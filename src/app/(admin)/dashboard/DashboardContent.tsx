"use client";

import { useState, useEffect, useCallback } from "react";
import { AppointmentCard } from "@/components/AppointmentCard";
import { ClientCRMPanel } from "@/components/ClientCRMPanel";

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

export function DashboardContent({ today }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  const fetchAppointments = useCallback(async () => {
    const res = await fetch(`/api/appointments?date=${today}`);
    const data = await res.json();
    setAppointments(data);
  }, [today]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  async function handleComplete(id: string) {
    await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    fetchAppointments();
  }

  async function handleCancel(id: string) {
    await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    fetchAppointments();
  }

  function handleSelectAppointment(appt: Appointment) {
    setSelectedClientId(appt.clientId);
    setSelectedAppointment(appt);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Agenda del día</h1>
        <p className="text-sm text-gray-500">
          {new Intl.DateTimeFormat("es-ES", {
            dateStyle: "full",
            timeZone: "America/Caracas",
          }).format(new Date())}
        </p>
      </div>

      {appointments.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
          <p className="text-gray-400">No hay citas para hoy</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => {
            const dateStr = new Intl.DateTimeFormat("es-ES", {
              dateStyle: "long",
              timeZone: "America/Caracas",
            }).format(new Date(appt.startTime * 1000));

            const timeStr = new Intl.DateTimeFormat("es-ES", {
              timeStyle: "short",
              timeZone: "America/Caracas",
            }).format(new Date(appt.startTime * 1000));

            return (
              <AppointmentCard
                key={appt.id}
                id={appt.id}
                startTime={appt.startTime}
                clientName={appt.clientName}
                clientId={appt.clientId}
                serviceName={appt.serviceName}
                referencePhotoUrl={appt.referencePhotoUrl}
                status={appt.status}
                appointmentDate={dateStr}
                appointmentTime={timeStr}
                onComplete={handleComplete}
                onCancel={handleCancel}
                onSelect={() => handleSelectAppointment(appt)}
              />
            );
          })}
        </div>
      )}

      {selectedClientId && selectedAppointment && (
        <ClientCRMPanel
          clientId={selectedClientId}
          serviceName={selectedAppointment.serviceName}
          appointmentDate={new Intl.DateTimeFormat("es-ES", {
            dateStyle: "long",
            timeZone: "America/Caracas",
          }).format(new Date(selectedAppointment.startTime * 1000))}
          appointmentTime={new Intl.DateTimeFormat("es-ES", {
            timeStyle: "short",
            timeZone: "America/Caracas",
          }).format(new Date(selectedAppointment.startTime * 1000))}
          onClose={() => {
            setSelectedClientId(null);
            setSelectedAppointment(null);
          }}
        />
      )}
    </div>
  );
}
