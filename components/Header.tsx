"use client";

import { ChefHat } from "lucide-react";
import type { Tab } from "@/components/appShellStyles";

type Props = {
  status: "authenticated" | "loading" | "unauthenticated";
  session: any;
  tab: Tab;
};

export function Header({ status, session, tab }: Props) {
  return (
    <header className="sticky top-0 z-10 bg-white/92 backdrop-blur-lg border-b border-warm-200 shadow-header px-4 py-3">
      <div className="flex items-center justify-center max-w-[900px] mx-auto">
        <div className="flex items-center gap-2">
          <ChefHat size={24} className="text-primary-600" strokeWidth={2.5} />
          <span className="text-lg font-extrabold tracking-tight text-primary-700">
            Misena
          </span>
        </div>
      </div>
    </header>
  );
}
