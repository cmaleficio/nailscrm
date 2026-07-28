import { Suspense } from "react";
import { BookingWizard } from "@/components/BookingWizard";

export default function BookPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-16 text-center text-gray-400">
          Cargando...
        </div>
      }
    >
      <BookingWizard />
    </Suspense>
  );
}
