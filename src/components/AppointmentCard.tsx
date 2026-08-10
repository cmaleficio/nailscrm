"use client";

import Image from "next/image";

type Props = {
  id: string;
  startTime: number;
  clientName: string;
  clientId: string;
  serviceName: string;
  referencePhotoUrl: string | null;
  status: string;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
  onSelect: (clientId: string) => void;
  onReschedule?: (id: string) => void;
};

export function AppointmentCard({
  id,
  startTime,
  clientName,
  clientId,
  serviceName,
  referencePhotoUrl,
  status,
  onComplete,
  onCancel,
  onSelect,
  onReschedule,
}: Props) {
  const time = new Intl.DateTimeFormat("es-ES", {
    timeStyle: "short",
    timeZone: "America/Caracas",
  }).format(new Date(startTime * 1000));

  return (
    <div
      className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="min-w-[3rem] text-center">
        <p className="text-sm font-semibold text-gray-900">{time}</p>
      </div>

      {referencePhotoUrl && (
        <Image
          src={referencePhotoUrl}
          alt="Referencia"
          width={48}
          height={48}
          className="h-12 w-12 rounded-lg object-cover"
        />
      )}

      <div className="flex-1 min-w-0">
        <button
          onClick={() => onSelect(clientId)}
          className="text-left"
        >
          <p className="font-medium text-gray-900 truncate">{clientName}</p>
          <p className="text-sm text-gray-500 truncate">{serviceName}</p>
        </button>
      </div>

      <div className="flex gap-2">
        {status === "pending" || status === "confirmed" ? (
          <>
            <button
              onClick={() => onComplete(id)}
              className="rounded-lg bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-200 transition-colors"
            >
              Completar
            </button>
            <button
              onClick={() => onCancel(id)}
              className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
            >
              Cancelar
            </button>
            {onReschedule && (
              <button
                onClick={() => onReschedule(id)}
                className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors"
              >
                Reprogramar
              </button>
            )}
          </>
        ) : (
          <span
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              status === "completed"
                ? "bg-green-50 text-green-600"
                : status === "cancelled"
                  ? "bg-red-50 text-red-600"
                  : "bg-gray-50 text-gray-500"
            }`}
          >
            {status === "completed"
              ? "Completada"
              : status === "cancelled"
                ? "Cancelada"
                : status}
          </span>
        )}
      </div>
    </div>
  );
}
