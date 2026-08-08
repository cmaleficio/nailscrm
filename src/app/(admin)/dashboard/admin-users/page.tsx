import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isSuperAdmin } from "@/lib/authz";
import { AdminUsersContent } from "./AdminUsersContent";

export default async function Page() {
  const session = await auth();
  if (!(await isSuperAdmin(session))) {
    redirect("/dashboard");
  }
  return <AdminUsersContent />;
}