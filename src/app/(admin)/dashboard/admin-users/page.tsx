import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isSuperAdmin, hasPermission } from "@/lib/authz";
import { AdminUsersContent } from "./AdminUsersContent";

export default async function Page() {
  const session = await auth();
  if (!(await isSuperAdmin(session)) || !(await hasPermission(session, "adminUsers"))) {
    redirect("/dashboard");
  }
  return <AdminUsersContent />;
}