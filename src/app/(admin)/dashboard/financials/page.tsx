import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";
import { FinancialsContent } from "./FinancialsContent";

export default async function FinancialsPage() {
  const session = await auth();
  if (!(await isAdmin(session))) redirect("/");
  return <FinancialsContent />;
}
