"use client";

import type { Lang, Recipe } from "@/lib/types";
import type { Tab } from "@/components/appShellStyles";
import { Clock, Coins, X, Plus, Check } from "lucide-react";

type Props = {
  filteredRecipes: Recipe[];
  recipeQuery: string;
  setRecipeQuery: (q: string) => void;
  queueIdSet: Set<string>;
  queue: any[];
  lang: Lang;
  t: Record<string, string>;
  toggleQueue: (recipeId: string) => void;
  setTodayWithTransition: (r: Recipe | null) => void;
  setTab: (t: Tab) => void;
};

export function RecipesTab({
  filteredRecipes, recipeQuery, setRecipeQuery, queueIdSet, queue,
  lang, t, toggleQueue, setTodayWithTransition, setTab,
}: Props) {
  return (
    <section className="w-full max-w-[900px] bg-white border border-warm-200 rounded-2xl p-4 shadow-card">
      <h2 className="text-xl font-extrabold text-warm-900 mb-3">{t.recipes}</h2>

      <div className="flex gap-2 items-center mb-3">
        <input
          value={recipeQuery}
          onChange={(e) => setRecipeQuery(e.target.value)}
          placeholder="Buscar por nombre o ingrediente…"
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
        <button
          type="button"
          className="px-3 py-2 rounded-xl border border-warm-200 bg-white text-sm font-bold text-warm-700 whitespace-nowrap hover:border-primary-300 cursor-pointer"
          onClick={() => setTab("plan")}
        >
          Ver lista ({queue.length})
        </button>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {filteredRecipes.map((r) => {
          const inQueue = queueIdSet.has(r.id);
          return (
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
              <div className="flex items-start justify-between gap-2">
                <div className="font-bold text-warm-800">{r.title?.[lang] || r.title?.es}</div>
                <button
                  type="button"
                  title={inQueue ? "Quitar de la cola" : "Añadir a la cola"}
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center cursor-pointer shrink-0 ${
                    inQueue
                      ? "border-primary-600 bg-primary-600 text-white"
                      : "border-warm-200 bg-white text-warm-500 hover:border-primary-400"
                  }`}
                  onClick={(e) => { e.stopPropagation(); toggleQueue(r.id); }}
                >
                  {inQueue ? <Check size={14} /> : <Plus size={14} />}
                </button>
              </div>

              <div className="flex gap-1.5 flex-wrap mt-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold">
                  <Clock size={12} /> {r.timeMin}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent-50 text-accent-700 text-xs font-semibold">
                  <Coins size={12} /> {"€".repeat(r.costTier)}
                </span>
              </div>

              <div className="text-sm text-warm-500 mt-2 line-clamp-2">{r.description?.[lang] || r.description?.es}</div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-warm-400 text-sm">Tip: toca una receta para ponerla como &quot;Hoy&quot;.</p>
    </section>
  );
}
