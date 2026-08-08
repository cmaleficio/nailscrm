import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { BookingWizard } from "@/components/BookingWizard";

export default async function BookPage() {
  const session = await auth();
  if (session?.user?.id) {
    const user = db.select({ phone: schema.users.phone }).from(schema.users).where(eq(schema.users.id, session.user.id)).get();
    if (user && !user.phone) {
      redirect("/complete-registration");
    }
  }
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
