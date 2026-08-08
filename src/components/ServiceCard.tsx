"use client";

import { useState } from "react";
import Link from "next/link";

type ServiceCardProps = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationMins: number;
  photos: { id: string; url: string }[];
};

export function ServiceCard({
  id,
  name,
  description,
  price,
  durationMins,
  photos,
}: ServiceCardProps) {
  const [index, setIndex] = useState(0);
  const photo = photos.length > 0 ? photos[Math.min(index, photos.length - 1)] : null;
  const prev = () => setIndex((i) => (i - 1 + photos.length) % photos.length);
  const next = () => setIndex((i) => (i + 1) % photos.length);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="relative overflow-hidden rounded-xl bg-gray-soft">
        {photo ? (
          <>
            <img src={photo.url} alt={name} className="h-36 w-full object-cover" />
            {photos.length > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1 hover:bg-white transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={next}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1 hover:bg-white transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </>
        ) : (
          <div className="flex h-36 items-center justify-center text-gray-300">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
          {description && (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span>${price.toFixed(2)}</span>
        <span className="text-gray-300">|</span>
        <span>{durationMins} min</span>
      </div>
      <Link
        href={`/book?serviceId=${id}`}
        className="mt-2 rounded-xl bg-pink-main px-4 py-2.5 text-center text-sm font-medium text-gray-900 transition-colors hover:bg-pink-light"
      >
        Agendar
      </Link>
    </div>
  );
}
