import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";
import { BalancesContent } from "./BalancesContent";

export default async function BalancesPage() {
  const session = await auth();
  if (!(await isAdmin(session))) redirect("/");
  return <BalancesContent />;
}
