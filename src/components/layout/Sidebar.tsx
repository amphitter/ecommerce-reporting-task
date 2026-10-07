"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Package,
  Warehouse,
  BarChart3,
  LogOut,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import clsx from "clsx";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Orders", icon: FileText },
  { href: "/products", label: "Products", icon: Package },
  { href: "/inventory", label: "Inventory", icon: Warehouse },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const NavContent = () => (
    <>
      <div className="flex items-center gap-2 px-4 py-5 border-b border-surface-border">
        <div className="w-8 h-8 rounded bg-brand-blue flex items-center justify-center">
          <span className="text-white font-bold text-sm">N</span>
        </div>
        <div>
          <div className="font-bold text-text-primary text-sm leading-tight">NexusOps</div>
          <div className="text-[10px] text-text-muted uppercase tracking-wider">Enterprise Analytics</div>
        </div>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {navItems.map(item => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors",
                active
                  ? "bg-brand-blue text-white shadow-sm"
                  : "text-text-secondary hover:bg-gray-100 hover:text-text-primary"
              )}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 2} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-surface-border p-2 space-y-0.5">
        <Link
          href="/admin/import"
          onClick={() => setMobileOpen(false)}
          className={clsx(
            "flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors",
            pathname.startsWith("/admin")
              ? "bg-gray-100 text-text-primary"
              : "text-text-secondary hover:bg-gray-100"
          )}
        >
          <Settings size={18} />
          <span>Admin / Import</span>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded text-sm font-medium text-text-secondary hover:bg-red-50 hover:text-critical transition-colors"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile header toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="xl:hidden fixed top-3 left-3 z-40 w-10 h-10 flex items-center justify-center rounded bg-white border border-surface-border shadow-card"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden xl:flex fixed top-0 left-0 h-screen w-60 bg-white border-r border-surface-border flex-col z-30">
        <NavContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="xl:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute top-0 left-0 h-full w-64 bg-white flex flex-col shadow-modal">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            <NavContent />
          </aside>
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="xl:hidden fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-surface-border flex items-center justify-around z-20">
        {navItems.map(item => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex flex-col items-center gap-0.5 px-2 py-1 rounded",
                active ? "text-brand-blue" : "text-text-muted"
              )}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
