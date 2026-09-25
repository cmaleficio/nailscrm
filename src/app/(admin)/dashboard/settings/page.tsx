import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authz";
import { redirect } from "next/navigation";
import { SettingsContent } from "./SettingsContent";

export default async function SettingsPage() {
  const session = await auth();
  if (!(await hasPermission(session, "workingHours"))) redirect("/");
  const canManageNavigation = await hasPermission(session, "navigation");
  return <SettingsContent canManageNavigation={canManageNavigation} />;
}
