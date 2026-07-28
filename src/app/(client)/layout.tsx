import { auth } from "@/lib/auth";
import { Header } from "@/components/Header";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <>
      <Header user={session?.user ?? null} />
      <main className="flex-1">{children}</main>
    </>
  );
}
