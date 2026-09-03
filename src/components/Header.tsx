"use client";

import Link from "next/link";
import Image from "next/image";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { SignOutButton } from "./SignOutButton";
import { useEffect, useState } from "react";

type NavItem = {
  id: string;
  label: string;
  href: string;
  isActive: number;
  openInNewTab: number;
};

type HeaderProps = {
  user: {
    name?: string | null;
    image?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
};

const DEFAULT_SALON_NAME = "Nails Salon";

export function Header({ user }: HeaderProps) {
  const [salonName, setSalonName] = useState<string>(DEFAULT_SALON_NAME);
  const [salonLogo, setSalonLogo] = useState<string>("");
  const [navItems, setNavItems] = useState<NavItem[]>([]);

  useEffect(() => {
    fetch("/api/brand")
      .then((r) => r.json())
      .then((data: { name?: string; logo_url?: string }) => {
        if (data.name) setSalonName(data.name);
        if (data.logo_url) setSalonLogo(data.logo_url);
      })
      .catch(() => {});

    fetch("/api/nav-items")
      .then((r) => r.json())
      .then((data: NavItem[]) => setNavItems(data))
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            {salonLogo ? (
              <div className="relative h-8 w-8 overflow-hidden rounded-lg">
                <Image
                  src={salonLogo}
                  alt={salonName}
                  fill
                  className="object-contain"
                />
              </div>
            ) : null}
            {salonName}
          </Link>
          {navItems.length > 0 && (
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  target={item.openInNewTab ? "_blank" : undefined}
                  rel={item.openInNewTab ? "noopener noreferrer" : undefined}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          )}
        </div>
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
