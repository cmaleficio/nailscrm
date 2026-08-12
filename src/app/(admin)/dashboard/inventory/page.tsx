import { auth } from "@/lib/auth";
import { hasPermission, canAdjustInventory } from "@/lib/authz";
import { redirect } from "next/navigation";
import { InventoryContent } from "./InventoryContent";

export default async function InventoryPage() {
  const session = await auth();
  if (!(await hasPermission(session, "inventory"))) redirect("/");
  const canAdjust = await canAdjustInventory(session);
  return <InventoryContent canAdjust={canAdjust} />;
}
