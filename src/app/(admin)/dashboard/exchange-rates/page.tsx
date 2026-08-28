import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authz";
import { redirect } from "next/navigation";
import { ExchangeRatesContent } from "./ExchangeRatesContent";

export default async function ExchangeRatesPage() {
  const session = await auth();
  if (!(await hasPermission(session, "settings"))) redirect("/");
  return <ExchangeRatesContent />;
}