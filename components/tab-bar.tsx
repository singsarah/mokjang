"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "@/components/icon";
import { CalendarIcon, ChartIcon, GearIcon, NotebookIcon } from "@/components/flat-icons";
import type { ComponentType } from "react";

const TABS: {
  href: string;
  label: string;
  img?: IconName;
  FlatIcon?: ComponentType<{ className?: string }>;
}[] = [
  { href: "/attendance", label: "출석", img: "sheep-face" },
  { href: "/calendar", label: "일정", FlatIcon: CalendarIcon },
  { href: "/minutes", label: "회의록", FlatIcon: NotebookIcon },
  { href: "/dashboard", label: "대시보드", FlatIcon: ChartIcon },
  { href: "/settings", label: "설정", FlatIcon: GearIcon },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white">
      <ul className="mx-auto flex max-w-md">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 text-sm",
                  active
                    ? "font-semibold text-sage-deep"
                    : "font-normal text-ink-muted hover:text-ink",
                )}
              >
                {/* 아이콘 슬롯 높이를 22px로 통일 — 양 이미지(26px)는 슬롯 밖으로
                    살짝 삐져나오게 중앙 배치해 라벨 줄이 다른 탭과 어긋나지 않게 */}
                <span className="flex h-[22px] w-[26px] items-center justify-center">
                  {tab.img ? (
                    <Icon name={tab.img} size={26} className="max-w-none shrink-0" />
                  ) : tab.FlatIcon ? (
                    <tab.FlatIcon className="h-[22px] w-[22px]" />
                  ) : null}
                </span>
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
