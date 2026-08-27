import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authz";
import { redirect } from "next/navigation";
import { BrandContent } from "./BrandContent";

export default async function BrandPage() {
  const session = await auth();
  if (!(await hasPermission(session, "settings"))) redirect("/");
  return <BrandContent />;
}
