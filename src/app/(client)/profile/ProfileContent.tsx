"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { StatsBanner } from "@/components/StatsBanner";
import { ReportPaymentDialog } from "@/components/ReportPaymentDialog";

type ProfileUser = {
  name: string;
  email: string;
  phone: string | null;
  role: string;
  image: string | null;
  totalVisits: number;
  totalRevenue: number;
};

type Appointment = {
  id: string;
  startTime: number;
  finalPhotoUrl: string | null;
  reviewRating: number | null;
  reviewText: string | null;
  serviceName: string;
};

type UpcomingAppointment = {
  id: string;
  startTime: number;
  endTime: number;
  status: string;
  referencePhotoUrl: string | null;
  serviceName: string;
};

type StatementItem = {
  id: string;
  serviceName: string;
  price: number;
  financialStatus: string;
  completionDate: number | null;
  startTime: number | null;
};

type Props = {
  user: ProfileUser;
  appointments: Appointment[];
  upcomingAppointments: UpcomingAppointment[];
  balanceUsd: number;
  statementItems: StatementItem[];
};

type Receipt = {
  id: string;
  amountVes: number;
  rate: number;
  amountUsd: number;
  status: string;
  photoUrl: string;
  reviewNotes: string | null;
  createdAt: number;
};

export function ProfileContent({ user, appointments, upcomingAppointments, balanceUsd, statementItems }: Props) {
  const router = useRouter();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  const loadReceipts = useCallback(() => {
    fetch("/api/payment-receipts")
      .then((r) => r.json())
      .then((data) => setReceipts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  async function handleCancel(id: string) {
    setCancellingId(id);
    setCancelError("");
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo cancelar la cita");
      }
      setConfirmingId(null);
      router.refresh();
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        {user.image && (
          <Image
            src={user.image}
            alt={user.name}
            width={80}
            height={80}
            className="mx-auto mb-3 h-20 w-20 rounded-full object-cover"
          />
        )}
        <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
        <p className="mt-1 text-sm text-gray-500">{user.email}</p>
        {user.phone && (
          <p className="text-sm text-gray-500">
            <a href={`https://wa.me/${user.phone.replace(/[^0-9]/g, "")}`} className="hover:text-gray-700">
              WhatsApp: {user.phone}
            </a>
          </p>
        )}
        {user.role === "admin" && (
          <Link
            href="/dashboard"
            className="mt-3 inline-block rounded-xl border border-pink-main px-4 py-2 text-sm font-medium text-pink-600 hover:bg-pink-light transition-colors"
          >
            Ir al dashboard
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="mb-8">
        <StatsBanner
          totalVisits={user.totalVisits}
        />
      </div>

      {/* CTA */}
      <div className="mb-10">
        <Link
          href="/book"
          className="flex items-center justify-center gap-2 rounded-xl bg-pink-main px-6 py-3 text-sm font-medium text-gray-900 hover:bg-pink-light transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Agendar nueva cita
        </Link>
      </div>

      {/* Próximas citas */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Mis próximas citas
        </h2>
        {upcomingAppointments.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
            <p className="text-gray-400">No tienes citas próximas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingAppointments.map((appt) => (
              <div
                key={appt.id}
                className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                {appt.referencePhotoUrl && (
                  <Image
                    src={appt.referencePhotoUrl}
                    alt="Referencia"
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">
                    {appt.serviceName}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Intl.DateTimeFormat("es-ES", {
                      dateStyle: "long",
                      timeZone: "America/Caracas",
                    }).format(new Date(appt.startTime * 1000))}
                    {" · "}
                    {new Intl.DateTimeFormat("es-ES", {
                      timeStyle: "short",
                      timeZone: "America/Caracas",
                    }).format(new Date(appt.startTime * 1000))}
                  </p>
                </div>
                <span
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    appt.status === "confirmed"
                      ? "bg-green-50 text-green-600"
                      : "bg-amber-50 text-amber-600"
                  }`}
                >
                  {appt.status === "confirmed" ? "Confirmada" : "Pendiente"}
                </span>
                {confirmingId === appt.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCancel(appt.id)}
                      disabled={cancellingId === appt.id}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {cancellingId === appt.id ? "Cancelando..." : "Sí, cancelar"}
                    </button>
                    <button
                      onClick={() => setConfirmingId(null)}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingId(appt.id)}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {cancelError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {cancelError}
          </p>
        )}
      </section>

      {/* Mi estado de cuenta */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Mi estado de cuenta
        </h2>
        {statementItems.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
            <p className="text-gray-400">Aún no tienes movimientos</p>
          </div>
        ) : (
          <div className="space-y-2">
            {statementItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {item.serviceName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Intl.DateTimeFormat("es-ES", {
                      dateStyle: "medium",
                      timeZone: "America/Caracas",
                    }).format(
                      new Date((item.startTime ?? item.completionDate ?? 0) * 1000)
                    )}
                  </p>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  ${item.price.toFixed(2)}
                </span>
                <span
                  className={`rounded-lg px-2 py-1 text-xs font-medium ${
                    item.financialStatus === "paid"
                      ? "bg-green-100 text-green-700"
                      : item.financialStatus === "partial"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-600"
                  }`}
                >
                  {item.financialStatus === "paid"
                    ? "Pagado"
                    : item.financialStatus === "partial"
                      ? "Abonado"
                      : "Pendiente"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Mis pagos */}
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Mis pagos</h2>
          {balanceUsd > 0 && (
            <button
              onClick={() => setShowReport(true)}
              className="rounded-xl bg-pink-main px-4 py-2 text-sm font-medium text-gray-900 hover:bg-pink-light transition-colors"
            >
              Reportar pago
            </button>
          )}
        </div>
        {balanceUsd > 0 ? (
          <p className="mb-3 text-sm text-gray-500">
            Debes{" "}
            <span className="font-semibold text-gray-900">${balanceUsd.toFixed(2)}</span>.
            Paga en Bs y adjunta la captura; el salón la aprobará.
          </p>
        ) : (
          <p className="mb-3 text-sm text-gray-500">No tienes saldo pendiente.</p>
        )}
        {receipts.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
            <p className="text-gray-400">Aún no has reportado pagos</p>
          </div>
        ) : (
          <div className="space-y-2">
            {receipts.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
                {r.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.photoUrl} alt="Captura" className="h-12 w-12 rounded-lg object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {r.amountVes.toFixed(2)} Bs ≈ ${r.amountUsd.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "America/Caracas" }).format(new Date(r.createdAt * 1000))}
                  </p>
                  {r.status === "rejected" && r.reviewNotes && (
                    <p className="text-xs text-red-600">Motivo: {r.reviewNotes}</p>
                  )}
                </div>
                <span
                  className={`rounded-lg px-2 py-1 text-xs font-medium ${
                    r.status === "approved"
                      ? "bg-green-100 text-green-700"
                      : r.status === "rejected"
                        ? "bg-red-100 text-red-600"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {r.status === "approved" ? "Aprobado" : r.status === "rejected" ? "Rechazado" : "Pendiente"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Timeline */}
      <section>
        <h2 className="mb-6 text-lg font-semibold text-gray-900">
          Mi Pasaporte de Uñas
        </h2>

        {appointments.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
            <p className="text-gray-400">Aún no tienes citas completadas</p>
            <Link
              href="/book"
              className="mt-4 inline-block rounded-xl bg-pink-main px-6 py-2 text-sm font-medium text-gray-900 hover:bg-pink-light transition-colors"
            >
              Agendar mi primera cita
            </Link>
          </div>
        ) : (
          <div className="relative space-y-6">
            {appointments.map((appt, index) => (
              <div key={appt.id} className="relative flex gap-4">
                {/* Timeline line */}
                {index < appointments.length - 1 && (
                  <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-pink-light" />
                )}

                {/* Dot */}
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-pink-main flex items-center justify-center">
                    <svg className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-sm text-gray-500">
                    {new Intl.DateTimeFormat("es-ES", {
                      dateStyle: "long",
                      timeZone: "America/Caracas",
                    }).format(new Date(appt.startTime * 1000))}
                  </p>
                  <p className="mt-1 font-medium text-gray-900">
                    {appt.serviceName}
                  </p>

                  {appt.finalPhotoUrl && (
                    <div className="relative mt-3 aspect-[4/3] w-full max-h-48 overflow-hidden rounded-lg">
                      <Image
                        fill
                        sizes="(max-width: 640px) 100vw, 512px"
                        src={appt.finalPhotoUrl}
                        alt="Resultado final"
                        className="object-cover"
                      />
                    </div>
                  )}

                  {appt.reviewRating && (
                    <div className="mt-3">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <svg
                            key={i}
                            className={`h-4 w-4 ${
                              i < appt.reviewRating!
                                ? "text-yellow-400"
                                : "text-gray-200"
                            }`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      {appt.reviewText && (
                        <p className="mt-1 text-sm text-gray-600">
                          {appt.reviewText}
                        </p>
                      )}
                    </div>
                  )}

                  {!appt.reviewRating && (
                    <Link
                      href={`/review/${appt.id}`}
                      className="mt-3 inline-block rounded-xl bg-pink-light px-4 py-2 text-sm font-medium text-gray-700 hover:bg-pink-main transition-colors"
                    >
                      Dejar reseña
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showReport && (
        <ReportPaymentDialog
          balanceUsd={balanceUsd}
          appointments={appointments.map((a) => ({
            id: a.id,
            serviceName: a.serviceName,
            startTime: a.startTime,
          }))}
          onClose={() => setShowReport(false)}
          onSaved={() => {
            setShowReport(false);
            loadReceipts();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
