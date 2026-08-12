import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authz";
import { redirect } from "next/navigation";
import { FinancialsContent } from "./FinancialsContent";

export default async function FinancialsPage() {
  const session = await auth();
  if (!(await hasPermission(session, "financials"))) redirect("/");
  return <FinancialsContent />;
}
