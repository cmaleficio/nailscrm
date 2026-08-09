"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SignOutButton } from "@/components/SignOutButton";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Agenda", icon: "📅" },
  { href: "/dashboard/clients", label: "Clientes", icon: "👤" },
  { href: "/dashboard/balances", label: "Cuentas por cobrar", icon: "💰" },
  { href: "/dashboard/purchases", label: "Compras", icon: "🛒" },
  { href: "/dashboard/accounts-payable", label: "Cuentas por pagar", icon: "💳" },
  { href: "/dashboard/inventory", label: "Inventario", icon: "📦" },
  { href: "/dashboard/financials", label: "Estados financieros", icon: "📊" },
  { href: "/dashboard/settings", label: "Configuración", icon: "⏰" },
  { href: "/dashboard/services", label: "Servicios", icon: "💅" },
  { href: "/dashboard/admin-users", label: "Admins", icon: "🛡️" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-soft">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-white border-r border-gray-200 transition-transform duration-200 lg:relative lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4">
            <Link href="/" className="text-lg font-semibold text-gray-900">
              Admin
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-1 hover:bg-gray-100 lg:hidden"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "bg-pink-main text-gray-900 font-medium"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-gray-100 px-4 py-3">
            <Link
              href="/profile"
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Mi perfil
            </Link>
            <div className="mt-2">
              <Link
                href="/"
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Volver al inicio
              </Link>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
              <span className="text-sm text-gray-500">Admin</span>
              <SignOutButton />
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1 hover:bg-gray-100"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm font-medium text-gray-900">Admin</span>
          <div className="w-8" />
        </header>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
