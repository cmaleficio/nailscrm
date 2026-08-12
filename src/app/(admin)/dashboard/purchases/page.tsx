import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authz";
import { redirect } from "next/navigation";
import { PurchasesContent } from "./PurchasesContent";

export default async function PurchasesPage() {
  const session = await auth();
  if (!(await hasPermission(session, "purchases"))) redirect("/");
  return <PurchasesContent />;
}
