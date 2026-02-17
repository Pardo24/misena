"use client";

import {
  UtensilsCrossed,
  BookOpen,
  CalendarDays,
  ShoppingCart,
  Package,
  Settings,
} from "lucide-react";
import type { Tab } from "@/components/appShellStyles";

const NAV_ITEMS: Array<{ key: Tab; icon: typeof UtensilsCrossed; labelKey: string }> = [
  { key: "today", icon: UtensilsCrossed, labelKey: "today" },
  { key: "recipes", icon: BookOpen, labelKey: "recipes" },
  { key: "plan", icon: CalendarDays, labelKey: "plan" },
  { key: "shop", icon: ShoppingCart, labelKey: "shop" },
  { key: "pantry", icon: Package, labelKey: "pantry" },
  { key: "settings", icon: Settings, labelKey: "settings" },
];

type Props = {
  tab: Tab;
  setTab: (t: Tab) => void;
  t: Record<string, string>;
};

export function BottomNav({ tab, setTab, t }: Props) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 bg-white/92 backdrop-blur-lg border-t border-warm-200 shadow-nav pb-[env(safe-area-inset-bottom)]">
      <nav className="mx-auto w-full max-w-[900px] flex justify-between px-2 pt-1.5 pb-1">
        {NAV_ITEMS.map((item) => {
          const active = tab === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              aria-label={t[item.labelKey]}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl min-h-[48px] cursor-pointer border-0 bg-transparent transition-colors ${
                active
                  ? "text-primary-600"
                  : "text-warm-400 hover:text-warm-600"
              }`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                {active && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-primary-500" />
                )}
              </div>
              <span className={`text-[11px] whitespace-nowrap ${active ? "font-bold" : "font-semibold"}`}>
                {t[item.labelKey]}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
