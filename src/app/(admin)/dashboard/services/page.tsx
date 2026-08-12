import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/authz";
import { ServicesContent } from "./ServicesContent";

export default async function ServicesPage() {
  const session = await auth();
  if (!(await hasPermission(session, "services"))) {
    redirect("/dashboard");
  }
  return <ServicesContent />;
}