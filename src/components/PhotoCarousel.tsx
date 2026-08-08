"use client";

import { useState } from "react";

type Photo = { id: string; url: string };

export function PhotoCarousel({ photos }: { photos: Photo[] }) {
  const [index, setIndex] = useState(0);
  if (photos.length === 0) return null;
  const current = photos[Math.min(index, photos.length - 1)];
  const prev = () => setIndex((i) => (i - 1 + photos.length) % photos.length);
  const next = () => setIndex((i) => (i + 1) % photos.length);

  return (
    <div className="mb-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Modelos de referencia
      </p>
      <div className="relative overflow-hidden rounded-xl bg-gray-soft">
        <img src={current.url} alt="Modelo de referencia" className="h-52 w-full object-cover" />
        {photos.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 hover:bg-white transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 hover:bg-white transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {photos.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setIndex(i)}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === index ? "bg-pink-main" : "bg-gray-300"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
