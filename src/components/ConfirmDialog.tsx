"use client";

type Props = {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirmar",
  danger = false,
  busy = false,
  error = null,
  onConfirm,
  onClose,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">{message}</p>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              danger
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-pink-main text-gray-900 hover:bg-pink-light"
            }`}
          >
            {busy ? "Procesando..." : confirmLabel}
          </button>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-xl bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
