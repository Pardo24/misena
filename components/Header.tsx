"use client";

import { ChefHat, User, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Tab } from "@/components/appShellStyles";

type Props = {
  status: "authenticated" | "loading" | "unauthenticated";
  session: any;
  tab: Tab;
};

export function Header({ status, session, tab }: Props) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-10 bg-white/92 backdrop-blur-lg border-b border-warm-200 shadow-header px-4 py-3">
      <div className="flex items-center justify-between max-w-[900px] mx-auto">
        <div className="flex items-center gap-2">
          <ChefHat size={24} className="text-primary-600" strokeWidth={2.5} />
          <span className="text-lg font-extrabold tracking-tight text-primary-700">
            Misena
          </span>
        </div>

        {status !== "authenticated" ? (
          <button
            type="button"
            className="inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-warm-200 bg-white text-warm-700 font-bold text-sm hover:border-primary-300 hover:text-primary-600 cursor-pointer"
            onClick={() => {
              sessionStorage.setItem("mise:returnTab", tab);
              router.push("/auth?mode=login");
            }}
            aria-label="Login"
          >
            <LogIn size={16} />
            <span>Login</span>
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-warm-200 bg-white text-warm-700 font-bold text-sm hover:border-primary-300 hover:text-primary-600 cursor-pointer"
            onClick={() => router.push("/account")}
            aria-label="Perfil"
          >
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt=""
                className="w-5 h-5 rounded-md object-cover border border-warm-200"
              />
            ) : (
              <User size={16} />
            )}
            <span className="max-w-[100px] truncate">
              {session?.user?.name || session?.user?.email || "Perfil"}
            </span>
          </button>
        )}
      </div>
    </header>
  );
}
