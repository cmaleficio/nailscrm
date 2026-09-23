"use client";

import { GalleryPublishControl } from "./GalleryPublishControl";

type Props = {
  appointmentId: string;
  clientName: string;
  serviceName: string;
  servicePrice: number;
  dateStr: string;
  timeStr: string;
  onClose: () => void;
  onUpdated?: () => void;
};

export function CompletedAppointmentDialog({
  appointmentId,
  clientName,
  serviceName,
  servicePrice,
  dateStr,
  timeStr,
  onClose,
  onUpdated,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">Cita completada</h3>
        <p className="mt-1 text-sm text-gray-500">
          {clientName} · {serviceName} · ${servicePrice.toFixed(2)}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          {dateStr} · {timeStr}
        </p>

        <div className="mt-5">
          <GalleryPublishControl
            appointmentId={appointmentId}
            onChange={onUpdated}
          />
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
