import Link from "next/link";
import { GoogleSignInButton } from "./GoogleSignInButton";

type HeaderProps = {
  user: {
    name?: string | null;
    image?: string | null;
    email?: string | null;
  } | null;
};

export function Header({ user }: HeaderProps) {
  const salonName = process.env.NEXT_PUBLIC_SALON_NAME || "Nails Salon";

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-gray-900">
          {salonName}
        </Link>
        <div className="flex items-center gap-3">
          {user ? (
            <Link
              href={user.email === process.env.ADMIN_EMAIL ? "/dashboard" : "/profile"}
              className="rounded-xl bg-pink-light px-4 py-2 text-sm text-gray-700 hover:bg-pink-main transition-colors"
            >
              Mi cuenta
            </Link>
          ) : (
            <GoogleSignInButton />
          )}
        </div>
      </div>
    </header>
  );
}
