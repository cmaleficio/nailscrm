import Link from "next/link";

export default function SuccessPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg
          className="h-8 w-8 text-green-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-gray-900">
        ¡Cita reservada!
      </h1>
      <p className="mt-2 text-gray-500">
        Te hemos enviado los detalles de tu cita. Te esperamos pronto.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <Link
          href="/profile"
          className="rounded-xl bg-pink-main px-6 py-3 text-sm font-medium text-gray-900 hover:bg-pink-light transition-colors"
        >
          Ver mis citas
        </Link>
        <Link
          href="/"
          className="rounded-xl border border-gray-200 px-6 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
