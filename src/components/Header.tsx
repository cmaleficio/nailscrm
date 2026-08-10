import Link from "next/link";
import Image from "next/image";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { SignOutButton } from "./SignOutButton";

type HeaderProps = {
  user: {
    name?: string | null;
    image?: string | null;
    email?: string | null;
    role?: string | null;
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
            <>
              {user.image && (
                <Image
                  src={user.image}
                  alt={user.name ?? "Usuario"}
                  width={32}
                  height={32}
                  className="hidden h-8 w-8 rounded-full object-cover sm:block"
                />
              )}
              <span className="hidden text-sm font-medium text-gray-700 sm:block">
                {user.name}
              </span>
              <Link
                href="/profile"
                className="rounded-xl bg-pink-light px-4 py-2 text-sm text-gray-700 hover:bg-pink-main transition-colors"
              >
                Mi cuenta
              </Link>
              {user.role === "admin" && (
                <Link
                  href="/dashboard"
                  className="rounded-xl border border-pink-main px-4 py-2 text-sm font-medium text-pink-600 hover:bg-pink-light transition-colors"
                >
                  Dashboard
                </Link>
              )}
              <SignOutButton />
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Entrar
              </Link>
              <GoogleSignInButton />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}