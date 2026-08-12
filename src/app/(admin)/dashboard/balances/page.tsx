import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authz";
import { redirect } from "next/navigation";
import { BalancesContent } from "./BalancesContent";

export default async function BalancesPage() {
  const session = await auth();
  if (!(await hasPermission(session, "balances"))) redirect("/");
  return <BalancesContent />;
}
