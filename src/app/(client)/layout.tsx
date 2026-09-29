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
      {/* Las etiquetas de analítica NO se montan aquí: viven en el <head> del
          layout raíz, que es el único able de escribirlo. El portal del cliente
          sí las recibe porque el proxy lo marca como scope público. */}
      <Header user={session?.user ?? null} />
      <main className="flex-1">{children}</main>
    </>
  );
}
