import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/authz";
import { DashboardContent } from "./DashboardContent";

export default async function DashboardPage() {
  const session = await auth();

  if (!(await hasPermission(session, "appointments"))) {
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
