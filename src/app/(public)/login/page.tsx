import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";
import { NOINDEX_METADATA } from "@/lib/seo";

export const metadata: Metadata = NOINDEX_METADATA;

export default function LoginPage() {
  return <LoginForm />;
}
