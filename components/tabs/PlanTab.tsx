"use client";

import type { Lang, Recipe } from "@/lib/types";
import type { Tab } from "@/components/appShellStyles";
import { Clock, Coins, ShoppingCart, ChevronUp, ChevronDown, X, Trash2 } from "lucide-react";

type Props = {
  queue: any[];
  recipeQuery: string;
  setRecipeQuery: (q: string) => void;
  lang: Lang;
  generateWeeklyShop: () => Promise<void>;
  moveQueue: (recipeId: string, dir: "up" | "down") => Promise<void>;
  loadQueue: () => Promise<void>;
  setTodayWithTransition: (r: Recipe | null) => void;
  setTab: (t: Tab) => void;
};

export function PlanTab({
  queue, recipeQuery, setRecipeQuery, lang,
  generateWeeklyShop, moveQueue, loadQueue, setTodayWithTransition, setTab,
}: Props) {
  return (
    <section className="w-full max-w-[900px] bg-white border border-warm-200 rounded-2xl p-4 shadow-card">
      <h2 className="text-xl font-extrabold text-warm-900 mb-3">Lista</h2>

      <div className="flex gap-2 items-center mb-3">
        <input
          value={recipeQuery}
          onChange={(e) => setRecipeQuery(e.target.value)}
          placeholder="Filtrar en la lista…"
          className="flex-1 px-3 py-2.5 rounded-full border border-warm-200 bg-warm-50 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
        />
        {recipeQuery && (
          <button
            type="button"
            className="w-9 h-9 rounded-xl border border-warm-200 bg-white flex items-center justify-center cursor-pointer text-warm-500 hover:text-warm-700"
            onClick={() => setRecipeQuery("")}
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white font-bold text-sm hover:bg-primary-700 cursor-pointer border-0 min-h-[44px]"
          onClick={async () => {
            await generateWeeklyShop();
            setTab("shop");
          }}
        >
          <ShoppingCart size={16} /> Lista compra semanal
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-warm-300 bg-white text-warm-700 font-bold text-sm hover:border-warm-400 cursor-pointer min-h-[44px]"
          onClick={async () => {
            await fetch("/api/queue/clear", { method: "POST" });
            await loadQueue();
          }}
        >
          <Trash2 size={16} /> Vaciar lista
        </button>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {queue
          .map((q: any) => q.recipe)
          .filter(Boolean)
          .filter((r: any) => {
            const qx = recipeQuery.trim().toLowerCase();
            if (!qx) return true;
            const title = String(r.title?.[lang] || r.title?.es || "").toLowerCase();
            const ing = Array.isArray(r.ingredients)
              ? r.ingredients.map((i: any) => String(i?.name?.[lang] || i?.name?.es || "").toLowerCase()).join(" ")
              : "";
            return title.includes(qx) || ing.includes(qx);
          })
          .map((r: any) => (
            <div
              key={r.id}
              role="button"
              tabIndex={0}
              className="text-left p-3 rounded-2xl border border-warm-200 bg-white shadow-card hover:shadow-card-hover transition-shadow cursor-pointer"
              onClick={() => { setTodayWithTransition(r); setTab("today"); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setTodayWithTransition(r);
                  setTab("today");
                }
              }}
            >
              {r.imageUrl && (
                <img
                  src={r.imageUrl}
                  alt={r.title?.[lang] || r.title?.es}
                  className="w-full h-32 object-cover rounded-xl mb-2"
                />
              )}
              <div className="flex items-start justify-between gap-2">
                <div className="font-bold text-warm-800">{r.title?.[lang] || r.title?.es}</div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    title="Subir"
                    className="w-8 h-8 rounded-xl border border-warm-200 bg-white flex items-center justify-center cursor-pointer text-warm-500 hover:text-primary-600 hover:border-primary-300"
                    onClick={async (e) => { e.stopPropagation(); await moveQueue(r.id, "up"); }}
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    title="Bajar"
                    className="w-8 h-8 rounded-xl border border-warm-200 bg-white flex items-center justify-center cursor-pointer text-warm-500 hover:text-primary-600 hover:border-primary-300"
                    onClick={async (e) => { e.stopPropagation(); await moveQueue(r.id, "down"); }}
                  >
                    <ChevronDown size={16} />
                  </button>
                  <button
                    type="button"
                    title="Quitar de la lista"
                    className="w-8 h-8 rounded-xl border border-warm-200 bg-white flex items-center justify-center cursor-pointer text-warm-500 hover:text-red-500 hover:border-red-300"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await fetch(`/api/queue?recipeId=${encodeURIComponent(r.id)}`, { method: "DELETE" });
                      await loadQueue();
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div className="flex gap-1.5 flex-wrap mt-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold">
                  <Clock size={12} /> {r.timeMin}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent-50 text-accent-700 text-xs font-semibold">
                  <Coins size={12} /> {"€".repeat(r.costTier)}
                </span>
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}
