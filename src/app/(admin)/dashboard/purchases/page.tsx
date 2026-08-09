import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";
import { PurchasesContent } from "./PurchasesContent";

export default async function PurchasesPage() {
  const session = await auth();
  if (!(await isAdmin(session))) redirect("/");
  return <PurchasesContent />;
}
