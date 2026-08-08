import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/authz";
import { ServicesContent } from "./ServicesContent";

export default async function ServicesPage() {
  const session = await auth();
  if (!(await isAdmin(session))) {
    redirect("/dashboard");
  }
  return <ServicesContent />;
}