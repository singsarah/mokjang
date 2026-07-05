"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/attendance", label: "출석", icon: "🐑" },
  { href: "/calendar", label: "일정", icon: "📅" },
  { href: "/dashboard", label: "대시보드", icon: "📊" },
  { href: "/settings", label: "설정", icon: "⚙️" },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white">
      <ul className="mx-auto flex max-w-md">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 text-xs",
                  active
                    ? "text-pasture-600 font-semibold"
                    : "text-gray-500 hover:text-gray-700",
                )}
              >
                <span className="text-xl">{tab.icon}</span>
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
