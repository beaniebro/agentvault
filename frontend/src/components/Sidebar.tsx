"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/create", label: "Create Vault", icon: "+" },
  { href: "/pending", label: "Pending", icon: "⏳" },
  { href: "/activity", label: "Activity", icon: "📋" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen p-4 flex flex-col">
      <div className="mb-8">
        <h1 className="text-xl font-bold">AgentVault</h1>
        <p className="text-gray-400 text-sm">Transaction Firewall</p>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-gray-700">
        <p className="text-xs text-gray-500">OpenClaw Hackathon 2026</p>
      </div>
    </aside>
  );
}
