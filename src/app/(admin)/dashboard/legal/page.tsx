import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authz";
import { redirect } from "next/navigation";
import { LegalContent } from "./LegalContent";

export default async function LegalPage() {
  const session = await auth();
  if (!(await hasPermission(session, "legalSettings"))) redirect("/");
  return <LegalContent />;
}
