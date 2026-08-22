"use client";

import { useState } from "react";

type ReviewFormProps = {
  appointmentId: string;
  alreadyReviewed: boolean;
};

export function ReviewForm({ appointmentId, alreadyReviewed }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo enviar la reseña");
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  if (alreadyReviewed) {
    return (
      <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
        Ya dejaste tu reseña para esta cita. ¡Gracias por tu opinión!
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
        ¡Gracias por tu reseña! 🌟
      </div>
    );
  }

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">
        ¿Cómo fue tu experiencia?
      </label>
      <div className="flex gap-1" role="radiogroup" aria-label="Calificación">
        {Array.from({ length: 5 }).map((_, i) => {
          const value = i + 1;
          const active = value <= (hover || rating);
          return (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              onMouseEnter={() => setHover(value)}
              onMouseLeave={() => setHover(0)}
              aria-label={`${value} estrella${value > 1 ? "s" : ""}`}
              className="rounded-lg p-1 transition-transform hover:scale-110"
            >
              <svg
                className={`h-9 w-9 ${active ? "text-yellow-400" : "text-gray-200"}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>
          );
        })}
      </div>

      <label className="mb-1 mt-4 block text-sm font-medium text-gray-700">
        Comentario (opcional)
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="Cuéntanos qué te pareció el servicio…"
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
      />

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || rating === 0}
        className="mt-4 w-full rounded-xl bg-pink-main px-6 py-2.5 text-sm font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50 transition-colors"
      >
        {submitting ? "Enviando…" : "Enviar reseña"}
      </button>
    </div>
  );
}
