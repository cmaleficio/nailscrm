import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authz";
import { redirect } from "next/navigation";
import { SettingsContent } from "./SettingsContent";

export default async function SettingsPage() {
  const session = await auth();
  if (!(await hasPermission(session, "settings"))) redirect("/");
  return <SettingsContent />;
}
