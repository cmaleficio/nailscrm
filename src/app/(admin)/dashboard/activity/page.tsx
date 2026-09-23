import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authz";
import { redirect } from "next/navigation";
import { ActivityLogContent } from "./ActivityLogContent";

export default async function ActivityPage() {
  const session = await auth();
  if (!(await hasPermission(session, "activityLog"))) redirect("/");
  return <ActivityLogContent />;
}