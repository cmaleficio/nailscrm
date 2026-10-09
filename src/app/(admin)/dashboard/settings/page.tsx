import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authz";
import { redirect } from "next/navigation";
import { SettingsContent } from "./SettingsContent";
import { isDuplicateDetectionEnabled } from "@/lib/app-settings";
import { db } from "@/db/index";

export default async function SettingsPage() {
  const session = await auth();
  if (!(await hasPermission(session, "workingHours"))) redirect("/");
  const canManageNavigation = await hasPermission(session, "navigation");
  const canManageClients = await hasPermission(session, "clients");
  return (
    <SettingsContent
      canManageNavigation={canManageNavigation}
      canManageClients={canManageClients}
      initialDetectDuplicates={isDuplicateDetectionEnabled(db)}
    />
  );
}
