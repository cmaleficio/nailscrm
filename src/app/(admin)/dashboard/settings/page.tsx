import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";
import { SettingsContent } from "./SettingsContent";

export default async function SettingsPage() {
  const session = await auth();
  if (!(await isAdmin(session))) redirect("/");
  return <SettingsContent />;
}
