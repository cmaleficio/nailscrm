import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/authz";
import { ClientsContent } from "./ClientsContent";

export default async function ClientsPage() {
  const session = await auth();
  if (!(await hasPermission(session, "clients"))) redirect("/");
  return <ClientsContent />;
}
