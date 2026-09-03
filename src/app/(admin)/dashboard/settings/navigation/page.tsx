import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authz";
import { redirect } from "next/navigation";
import { NavEditorContent } from "./NavEditorContent";

export default async function NavEditorPage() {
  const session = await auth();
  if (!(await hasPermission(session, "settings"))) redirect("/");
  return <NavEditorContent />;
}