import { auth } from "@/lib/auth";
import { getPermissions } from "@/lib/authz";
import AdminShell from "@/components/AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const permissions = await getPermissions(session);
  return <AdminShell permissions={permissions}>{children}</AdminShell>;
}