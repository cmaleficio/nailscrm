import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { CompleteRegistrationForm } from "./CompleteRegistrationForm";

export default async function CompleteRegistrationPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }
  const user = db.select().from(schema.users).where(eq(schema.users.id, session.user.id)).get();
  if (!user) {
    redirect("/");
  }
  if (user.phone) {
    redirect("/profile");
  }
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
        Completa tu registro
      </h1>
      <p className="mb-6 text-center text-sm text-gray-500">
        Necesitamos tu número de teléfono para contactarte sobre tus citas.
      </p>
      <CompleteRegistrationForm initialName={user.name} />
    </div>
  );
}
