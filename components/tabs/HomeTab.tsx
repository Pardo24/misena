"use client";

import { useState } from "react";
import type { Lang, Recipe, ShoppingItem } from "@/lib/types";
import type { Tab } from "@/components/appShellStyles";
import {
  Clock, Coins, ShoppingCart, ChevronUp, ChevronDown, X, Trash2,
  RefreshCw, Eye, Package, ChevronDown as ChevronDownIcon,
} from "lucide-react";

type Props = {
  session: any;
  today: Recipe | null;
  todayLoading: boolean;
  reroll: () => void;
  queue: any[];
  queueIdSet: Set<string>;
  toggleQueue: (recipeId: string) => void;
  generateWeeklyShop: () => Promise<void>;
  moveQueue: (recipeId: string, dir: "up" | "down") => Promise<void>;
  loadQueue: () => Promise<void>;
  shop: ShoppingItem[] | null;
  pantry: any[] | null;
  setTab: (t: Tab) => void;
  setDetailRecipe: (r: Recipe | null) => void;
  lang: Lang;
  t: Record<string, string>;
};

export function HomeTab({
  session, today, todayLoading, reroll,
  queue, queueIdSet, toggleQueue,
  generateWeeklyShop, moveQueue, loadQueue,
  shop, pantry, setTab, setDetailRecipe, lang, t,
}: Props) {
  const [showFullPlan, setShowFullPlan] = useState(false);

  const userName = session?.user?.name?.split(" ")[0] || "";
  const locale = lang === "ca" ? "ca-ES" : "es-ES";
  const dateStr = new Date().toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const planRecipes = queue
    .map((q: any) => q.recipe)
    .filter(Boolean)
    .filter((r: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === r.id) === i);

  const shopCount = shop?.length ?? 0;
  const pantryCount = pantry?.length ?? 0;

  return (
    <div className="w-full max-w-[900px] grid gap-4">
      {/* Greeting */}
      <div className="px-1">
        <h1 className="text-2xl font-extrabold text-warm-900">
          {t.greeting}{userName ? `, ${userName}` : ""} 👋
        </h1>
        <p className="text-warm-500 text-sm capitalize mt-0.5">{dateStr}</p>
      </div>

      {/* Plan section */}
      <section className="bg-white border border-warm-200 rounded-2xl p-4 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-extrabold text-warm-900">
            Tu plan ({planRecipes.length})
          </h2>
          {planRecipes.length > 0 && (
            <button
              type="button"
              className="text-sm font-bold text-primary-600 hover:text-primary-700 cursor-pointer bg-transparent border-0"
              onClick={() => setShowFullPlan(!showFullPlan)}
            >
              {showFullPlan ? "Cerrar" : "Ver todo"}
            </button>
          )}
        </div>

        {planRecipes.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-warm-400 text-sm mb-3">{t.planEmpty}</p>
            <button
              type="button"
              className="px-4 py-2.5 rounded-xl bg-primary-600 text-white font-bold text-sm hover:bg-primary-700 cursor-pointer border-0 min-h-[44px]"
              onClick={() => setTab("recipes")}
            >
              {t.exploreCta}
            </button>
          </div>
        ) : (
          <>
            {/* Horizontal scroll of mini cards */}
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
              {planRecipes.map((r: any) => (
                <button
                  key={r.id}
                  type="button"
                  className="shrink-0 w-36 text-left rounded-xl border border-warm-200 bg-warm-50 overflow-hidden cursor-pointer hover:shadow-card transition-shadow p-0"
                  onClick={() => setDetailRecipe(r)}
                >
                  {r.imageUrl && (
                    <img
                      src={r.imageUrl}
                      alt={r.title?.[lang] || r.title?.es}
                      className="w-full h-20 object-cover"
                    />
                  )}
                  <div className="p-2">
                    <div className="font-bold text-warm-800 text-xs line-clamp-2 leading-tight">
                      {r.title?.[lang] || r.title?.es}
                    </div>
                    <div className="flex gap-1 mt-1">
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-primary-700 font-semibold">
                        <Clock size={10} /> {r.timeMin}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-accent-700 font-semibold">
                        <Coins size={10} /> {"€".repeat(r.costTier)}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Weekly shop button */}
            <button
              type="button"
              className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white font-bold text-sm hover:bg-primary-700 cursor-pointer border-0 min-h-[44px]"
              onClick={generateWeeklyShop}
            >
              <ShoppingCart size={16} /> {t.weeklyShopCta}
            </button>

            {/* Full plan list (expanded) */}
            {showFullPlan && (
              <div className="mt-4 border-t border-warm-200 pt-4">
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-warm-300 bg-white text-warm-700 font-bold text-sm hover:border-warm-400 cursor-pointer min-h-[44px]"
                    onClick={async () => {
                      await fetch("/api/queue/clear", { method: "POST" });
                      await loadQueue();
                    }}
                  >
                    <Trash2 size={14} /> Vaciar lista
                  </button>
                </div>

                <div className="grid gap-2">
                  {planRecipes.map((r: any) => (
                    <div
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      className="flex items-center gap-3 p-3 rounded-xl border border-warm-200 bg-warm-50 cursor-pointer hover:bg-warm-100 transition-colors"
                      onClick={() => setDetailRecipe(r)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailRecipe(r); }
                      }}
                    >
                      {r.imageUrl && (
                        <img
                          src={r.imageUrl}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-warm-800 text-sm truncate">
                          {r.title?.[lang] || r.title?.es}
                        </div>
                        <div className="flex gap-1.5 mt-0.5">
                          <span className="inline-flex items-center gap-0.5 text-xs text-primary-700 font-semibold">
                            <Clock size={10} /> {r.timeMin}
                          </span>
                          <span className="inline-flex items-center gap-0.5 text-xs text-accent-700 font-semibold">
                            <Coins size={10} /> {"€".repeat(r.costTier)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          title="Subir"
                          className="w-8 h-8 rounded-lg border border-warm-200 bg-white flex items-center justify-center cursor-pointer text-warm-500 hover:text-primary-600"
                          onClick={(e) => { e.stopPropagation(); moveQueue(r.id, "up"); }}
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          type="button"
                          title="Bajar"
                          className="w-8 h-8 rounded-lg border border-warm-200 bg-white flex items-center justify-center cursor-pointer text-warm-500 hover:text-primary-600"
                          onClick={(e) => { e.stopPropagation(); moveQueue(r.id, "down"); }}
                        >
                          <ChevronDown size={14} />
                        </button>
                        <button
                          type="button"
                          title="Quitar"
                          className="w-8 h-8 rounded-lg border border-warm-200 bg-white flex items-center justify-center cursor-pointer text-warm-500 hover:text-red-500"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await fetch(`/api/queue?recipeId=${encodeURIComponent(r.id)}`, { method: "DELETE" });
                            await loadQueue();
                          }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Suggestion */}
      <section className="bg-white border border-warm-200 rounded-2xl p-4 shadow-card">
        <h2 className="text-lg font-extrabold text-warm-900 mb-3">{t.suggestion}</h2>

        {todayLoading ? (
          <div className="animate-pulse">
            <div className="h-40 rounded-xl bg-warm-100 mb-3" />
            <div className="h-5 rounded-xl bg-warm-200 w-[60%] mb-2" />
            <div className="h-4 rounded-xl bg-warm-100 w-[40%]" />
          </div>
        ) : !today ? (
          <p className="text-warm-400 text-sm text-center py-4">{t.empty}</p>
        ) : (
          <div>
            {today.imageUrl && (
              <img
                src={today.imageUrl}
                alt={today.title?.[lang] || today.title?.es}
                className="w-full h-44 object-cover rounded-xl mb-3"
              />
            )}
            <h3 className="font-extrabold text-warm-900 text-lg">
              {today.title?.[lang] || today.title?.es}
            </h3>
            <div className="flex gap-1.5 flex-wrap mt-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold">
                <Clock size={12} /> {today.timeMin} min
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent-50 text-accent-700 text-xs font-semibold">
                <Coins size={12} /> {"€".repeat(today.costTier)}
              </span>
            </div>
            {today.tags && today.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-2">
                {today.tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="px-1.5 py-0.5 rounded-md bg-warm-50 text-warm-500 text-[10px] font-semibold border border-warm-100">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-warm-300 bg-white text-warm-700 font-bold text-sm hover:border-warm-400 cursor-pointer min-h-[44px]"
                onClick={reroll}
              >
                <RefreshCw size={16} /> {t.reroll}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white font-bold text-sm hover:bg-primary-700 cursor-pointer border-0 min-h-[44px]"
                onClick={() => setDetailRecipe(today)}
              >
                <Eye size={16} /> Ver receta
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className="bg-white border border-warm-200 rounded-2xl p-4 shadow-card text-left cursor-pointer hover:shadow-card-hover transition-shadow"
          onClick={() => setTab("shop")}
        >
          <ShoppingCart size={24} className="text-primary-600 mb-2" />
          <div className="font-extrabold text-warm-900 text-sm">Lista de compra</div>
          <div className="text-warm-400 text-xs mt-0.5">
            {shopCount > 0 ? `${shopCount} productos` : "Sin productos"}
          </div>
        </button>
        <button
          type="button"
          className="bg-white border border-warm-200 rounded-2xl p-4 shadow-card text-left cursor-pointer hover:shadow-card-hover transition-shadow"
          onClick={() => setTab("profile")}
        >
          <Package size={24} className="text-accent-600 mb-2" />
          <div className="font-extrabold text-warm-900 text-sm">{t.pantry}</div>
          <div className="text-warm-400 text-xs mt-0.5">
            {pantryCount > 0 ? `${pantryCount} productos` : "Sin productos"}
          </div>
        </button>
      </div>
    </div>
  );
}
