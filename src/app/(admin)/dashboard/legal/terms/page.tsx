import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authz";
import { redirect } from "next/navigation";
import { TermsContent } from "../TermsContent";

export default async function TermsPage() {
  const session = await auth();
  if (!(await hasPermission(session, "legalSettings"))) redirect("/");
  return <TermsContent />;
}
