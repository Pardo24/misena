"use client";

import type { Lang, Recipe, Settings, ShoppingItem } from "@/lib/types";
import { RefreshCw, ShoppingCart } from "lucide-react";
import { RecipeDetailView } from "@/components/RecipeDetailView";

type Props = {
  today: Recipe | null;
  todayLoading: boolean;
  todayFadeIn: boolean;
  settings: Settings;
  lang: Lang;
  t: Record<string, string>;
  shop: ShoppingItem[] | null;
  cookedSummary: { name: string; qty: string }[] | null;
  reroll: () => void;
  generateShop: () => void;
  cooked: () => void;
};

function TodaySkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-5 rounded-xl bg-warm-200 w-[70%]" />
      <div className="h-3 rounded-xl bg-warm-100 mt-3 w-[95%]" />
      <div className="h-3 rounded-xl bg-warm-100 mt-2 w-[75%]" />

      <div className="flex gap-2 mt-3 flex-wrap">
        <div className="h-7 rounded-full bg-warm-100 w-18" />
        <div className="h-7 rounded-full bg-warm-100 w-18" />
        <div className="h-7 rounded-full bg-warm-100 w-18" />
      </div>

      <div className="flex gap-2 mt-4">
        <div className="h-10 rounded-xl bg-warm-100 w-28" />
        <div className="h-10 rounded-xl bg-warm-200 w-40" />
      </div>

      <hr className="border-0 border-t border-warm-200 my-4" />

      <div className="h-3.5 rounded-xl bg-warm-100 w-28 mt-1.5" />
      <div className="h-12 rounded-xl bg-warm-100 mt-3" />
      <div className="h-12 rounded-xl bg-warm-100 mt-2" />
      <div className="h-12 rounded-xl bg-warm-100 mt-2" />

      <div className="mt-4">
        <div className="h-3.5 rounded-xl bg-warm-100 w-28" />
        <div className="h-28 rounded-2xl bg-warm-100 mt-3" />
        <div className="h-28 rounded-2xl bg-warm-100 mt-2" />
      </div>
    </div>
  );
}

export function TodayTab({ today, todayLoading, todayFadeIn, settings, lang, t, cookedSummary, reroll, generateShop, cooked }: Props) {
  return (
    <section className="w-full max-w-[900px] bg-white border border-warm-200 rounded-2xl p-4 shadow-card overflow-hidden">
      {todayLoading ? (
        <TodaySkeleton />
      ) : !today ? (
        <div className="text-warm-500 text-center py-8">{t.empty}</div>
      ) : (
        <div className={`transition-all duration-150 ${todayFadeIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1.5"}`}>
          <RecipeDetailView
            recipe={today}
            settings={settings}
            lang={lang}
            renderActions={() => (
              <div className="flex gap-2 flex-wrap">
                <button
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-warm-300 bg-white text-warm-700 font-bold text-sm hover:border-warm-400 cursor-pointer min-h-[44px]"
                  onClick={reroll}
                >
                  <RefreshCw size={16} /> {t.reroll}
                </button>
                <button
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white font-bold text-sm hover:bg-primary-700 cursor-pointer min-h-[44px] border-0"
                  onClick={generateShop}
                >
                  <ShoppingCart size={16} /> {t.makeList}
                </button>
              </div>
            )}
          />

          {/* Cook CTA */}
          <div className="grid place-items-center pt-5">
            <button
              type="button"
              className="px-6 py-3 rounded-full bg-accent-500 text-white font-bold text-sm hover:bg-accent-600 cursor-pointer border-0 shadow-fab min-h-[44px]"
              onClick={cooked}
            >
              {t.cookThis}
            </button>
          </div>

          {/* Cooked summary */}
          {cookedSummary && (
            <div className="mt-4 p-3 rounded-xl border border-primary-200 bg-primary-50">
              <div className="font-black text-sm text-primary-800 mb-1.5">
                Descontado de la despensa:
              </div>
              <ul className="m-0 p-0 list-none">
                {cookedSummary.map((s, i) => (
                  <li key={i} className="flex justify-between py-1 text-sm">
                    <span className="capitalize text-warm-700">{s.name}</span>
                    <span className="text-primary-700 font-bold">{s.qty}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
