import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";
import { AccountsPayableContent } from "./AccountsPayableContent";

export default async function AccountsPayablePage() {
  const session = await auth();
  if (!(await isAdmin(session))) redirect("/");
  return <AccountsPayableContent />;
}
