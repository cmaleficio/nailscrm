import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authz";
import { redirect } from "next/navigation";
import { AccountsPayableContent } from "./AccountsPayableContent";

export default async function AccountsPayablePage() {
  const session = await auth();
  if (!(await hasPermission(session, "accountsPayable"))) redirect("/");
  return <AccountsPayableContent />;
}
