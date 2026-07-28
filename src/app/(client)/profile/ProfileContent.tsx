"use client";

import Link from "next/link";
import { StatsBanner } from "@/components/StatsBanner";

type ProfileUser = {
  name: string;
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

type Props = {
  user: ProfileUser;
  appointments: Appointment[];
};

export function ProfileContent({ user, appointments }: Props) {
  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        {user.image && (
          <img
            src={user.image}
            alt={user.name}
            className="mx-auto mb-3 h-20 w-20 rounded-full object-cover"
          />
        )}
        <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
      </div>

      {/* Stats */}
      <div className="mb-8">
        <StatsBanner
          totalVisits={user.totalVisits}
          totalRevenue={user.totalRevenue}
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
                    <img
                      src={appt.finalPhotoUrl}
                      alt="Resultado final"
                      className="mt-3 w-full rounded-lg object-cover max-h-48"
                    />
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
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
