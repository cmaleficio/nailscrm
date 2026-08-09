import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";
import { InventoryContent } from "./InventoryContent";

export default async function InventoryPage() {
  const session = await auth();
  if (!(await isAdmin(session))) redirect("/");
  return <InventoryContent />;
}
