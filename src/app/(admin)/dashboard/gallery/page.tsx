import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/authz";
import { GalleryContent } from "./GalleryContent";

export default async function GalleryPage() {
  const session = await auth();
  if (!(await hasPermission(session, "gallery"))) {
    redirect("/dashboard");
  }
  return <GalleryContent />;
}
