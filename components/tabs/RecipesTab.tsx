"use client";

import { useState, useMemo, useEffect } from "react";
import type { Lang, Recipe } from "@/lib/types";
import type { Tab } from "@/components/appShellStyles";
import { Clock, Coins, X, Plus, Check, ChevronLeft, ChevronRight, Flame } from "lucide-react";

const PAGE_SIZE = 24;

const TAG_LABELS: Record<string, string> = {
  vegan: "Vegano", vegetarian: "Vegetariano", pescatarian: "Pescetariano",
  quick: "Rápido", family: "Familia", "high-protein": "Proteico",
  "low-calorie": "Bajo en calorías", "low-carb": "Low carb",
  premium: "Premium", "one-pot": "Una olla", "one-pan": "Una sartén",
  "oven-only": "Solo horno", spicy: "Picante", "street-food": "Street food",
  regional: "Regional", new: "Novedad", lunch: "Lunch", dinner: "Dinner",
  japanese: "Japonesa", thai: "Tailandesa", chinese: "China",
  korean: "Coreana", indian: "India", mexican: "Mexicana",
  italian: "Italiana", mediterranean: "Mediterránea", spanish: "Española",
  asian: "Asiática",
};

// Display order for tag groups
const TAG_ORDER = [
  "quick", "family", "italian", "mediterranean", "spanish", "asian",
  "japanese", "thai", "chinese", "korean", "indian", "mexican",
  "vegan", "vegetarian", "pescatarian", "high-protein",
  "low-calorie", "low-carb", "one-pot", "one-pan", "oven-only",
  "spicy", "street-food", "regional", "premium", "new", "lunch", "dinner",
];

type Props = {
  filteredRecipes: Recipe[];
  recipeQuery: string;
  setRecipeQuery: (q: string) => void;
  queueIdSet: Set<string>;
  queue: any[];
  lang: Lang;
  t: Record<string, string>;
  toggleQueue: (recipeId: string) => void;
  setDetailRecipe: (r: Recipe | null) => void;
  setTab: (t: Tab) => void;
};

function RecipeCard({ r, lang, inQueue, toggleQueue, onClick }: {
  r: Recipe; lang: Lang; inQueue: boolean;
  toggleQueue: (id: string) => void; onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="text-left p-3 rounded-2xl border border-warm-200 bg-white shadow-card hover:shadow-card-hover transition-shadow cursor-pointer"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }
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
        {r.nutrition?.calories && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-semibold">
            <Flame size={12} /> {Math.round(r.nutrition.calories)} kcal
          </span>
        )}
      </div>

      {r.tags && r.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-1.5">
          {r.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 rounded-md bg-warm-50 text-warm-500 text-[10px] font-semibold border border-warm-100">
              {TAG_LABELS[tag] || tag}
            </span>
          ))}
          {r.tags.length > 3 && (
            <span className="px-1.5 py-0.5 rounded-md bg-warm-50 text-warm-400 text-[10px] font-semibold">
              +{r.tags.length - 3}
            </span>
          )}
        </div>
      )}

      <div className="text-sm text-warm-500 mt-2 line-clamp-2">{r.description?.[lang] || r.description?.es}</div>
    </div>
  );
}

export function RecipesTab({
  filteredRecipes, recipeQuery, setRecipeQuery, queueIdSet, queue,
  lang, t, toggleQueue, setDetailRecipe, setTab,
}: Props) {
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  function toggleTag(tag: string) {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  // Collect all unique tags from filtered recipes
  const allTags = useMemo(() => {
    const tagCount = new Map<string, number>();
    for (const r of filteredRecipes) {
      for (const tag of r.tags ?? []) {
        tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
      }
    }
    return TAG_ORDER.filter((t) => tagCount.has(t)).map((t) => ({ tag: t, count: tagCount.get(t)! }));
  }, [filteredRecipes]);

  // Filter recipes by active tags (must match ALL selected tags)
  const displayRecipes = useMemo(() => {
    if (activeTags.size === 0) return filteredRecipes;
    return filteredRecipes.filter((r) => {
      const rTags = r.tags ?? [];
      for (const t of activeTags) {
        if (!rTags.includes(t)) return false;
      }
      return true;
    });
  }, [filteredRecipes, activeTags]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [recipeQuery, activeTags]);

  const totalPages = Math.max(1, Math.ceil(displayRecipes.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRecipes = displayRecipes.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
          onClick={() => setTab("home")}
        >
          Ver lista ({queue.length})
        </button>
      </div>

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-3 items-center">
          {activeTags.size > 0 && (
            <button
              type="button"
              className="px-2.5 py-1.5 rounded-full border border-warm-300 bg-white text-warm-500 text-xs font-bold cursor-pointer hover:text-warm-700 hover:border-warm-400"
              onClick={() => setActiveTags(new Set())}
            >
              Limpiar
            </button>
          )}
          {allTags.map(({ tag, count }) => {
            const active = activeTags.has(tag);
            return (
              <button
                key={tag}
                type="button"
                className={`px-2.5 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-colors border ${
                  active
                    ? "bg-primary-600 text-white border-primary-600"
                    : "bg-warm-50 text-warm-600 border-warm-200 hover:border-primary-300 hover:text-primary-700"
                }`}
                onClick={() => toggleTag(tag)}
              >
                {TAG_LABELS[tag] || tag} ({count})
              </button>
            );
          })}
        </div>
      )}

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {pagedRecipes.map((r) => (
          <RecipeCard
            key={r.id}
            r={r}
            lang={lang}
            inQueue={queueIdSet.has(r.id)}
            toggleQueue={toggleQueue}
            onClick={() => setDetailRecipe(r)}
          />
        ))}
      </div>

      {displayRecipes.length === 0 && (
        <p className="text-warm-400 text-sm text-center py-6">No hay recetas con este filtro.</p>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            type="button"
            disabled={safePage <= 1}
            className="w-9 h-9 rounded-xl border border-warm-200 bg-white flex items-center justify-center cursor-pointer text-warm-600 hover:border-primary-300 disabled:opacity-30 disabled:cursor-default"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-warm-600">
            Página {safePage} de {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            className="w-9 h-9 rounded-xl border border-warm-200 bg-white flex items-center justify-center cursor-pointer text-warm-600 hover:border-primary-300 disabled:opacity-30 disabled:cursor-default"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <p className="mt-3 text-warm-400 text-sm">Tip: toca una receta para ver los detalles.</p>
    </section>
  );
}
