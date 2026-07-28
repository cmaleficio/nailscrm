import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardContent } from "./DashboardContent";

export default async function DashboardPage() {
  const session = await auth();

  if (session?.user?.email !== process.env.ADMIN_EMAIL) {
    redirect("/");
  }

  const today = new Intl.DateTimeFormat("es-ES", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .split("/")
    .reverse()
    .join("-");

  return <DashboardContent today={today} />;
}
