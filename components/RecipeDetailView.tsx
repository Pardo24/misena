"use client";

import { useState } from "react";
import type { Lang, Recipe, Settings } from "@/lib/types";
import {
  Clock, Coins, ChefHat, Tag, ChevronDown, ChevronUp,
  Flame, Beef, Wheat, Droplets, Leaf, AlertTriangle, Info,
} from "lucide-react";

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

function RichText({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(<span key={out.length}>{text.slice(last, m.index)}</span>);
    const token = m[0];
    if (token.startsWith("**")) out.push(<strong key={out.length}>{token.slice(2, -2)}</strong>);
    else out.push(<em key={out.length}>{token.slice(1, -1)}</em>);
    last = m.index + token.length;
  }
  if (last < text.length) out.push(<span key={out.length}>{text.slice(last)}</span>);
  return <>{out}</>;
}

// Matches lines like "RECUERDA: ...", "SABIAS QUE: ...", "CONSEJO: ...", "TRUCO: ..." etc.
const TIP_RE = /^[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ\s]{2,}:\s/;

function renderStepBody(bodyLines: string[]) {
  return (
    <ul className="m-0 pl-4 grid gap-1.5">
      {bodyLines.map((raw, i) => {
        const line = raw.trim();
        if (!line) return null;
        // Italic-wrapped tips (legacy format)
        if (line.startsWith("_") && line.endsWith("_")) {
          return (
            <li key={i} className="list-none -ml-4">
              <div className="relative p-3 rounded-xl border border-accent-200 bg-accent-50">
                <div className="text-sm text-accent-800">
                  <em><RichText text={line.slice(1, -1)} /></em>
                </div>
              </div>
            </li>
          );
        }
        // Uppercase keyword tips (RECUERDA:, SABIAS QUE:, CONSEJO:, etc.)
        const clean = line.startsWith("•") ? line.slice(1).trim() : line;
        if (TIP_RE.test(clean)) {
          return (
            <li key={i} className="list-none -ml-4">
              <div className="relative p-3 rounded-xl border border-accent-200 bg-accent-50">
                <div className="text-sm text-accent-800">
                  <RichText text={clean} />
                </div>
              </div>
            </li>
          );
        }
        return (
          <li key={i} className="text-warm-800 text-sm leading-relaxed list-disc">
            <RichText text={clean} />
          </li>
        );
      })}
    </ul>
  );
}

type Props = {
  recipe: Recipe;
  settings: Settings;
  lang: Lang;
  renderActions?: () => React.ReactNode;
};

export function RecipeDetailView({ recipe, settings, lang, renderActions }: Props) {
  const [showInfo, setShowInfo] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const hasNutrition = recipe.nutrition && Object.values(recipe.nutrition).some(Boolean);
  const hasAllergens = recipe.allergens && recipe.allergens.length > 0;
  const hasInfoData = hasNutrition || hasAllergens;
  const description = recipe.description[lang] || recipe.description.es || "";

  return (
    <div className="w-full min-w-0 overflow-hidden">
      {recipe.imageUrl && (
        <img
          src={recipe.imageUrl}
          alt={recipe.title[lang]}
          className="w-full max-w-full rounded-xl mb-3 max-h-[280px] object-cover bg-warm-50"
        />
      )}
      <h2 className="text-xl font-extrabold text-warm-900 mb-1">{recipe.title[lang]}</h2>

      {/* Collapsible description */}
      {description && (
        <button
          type="button"
          className="flex items-start gap-1 text-left w-full mb-3 cursor-pointer bg-transparent border-0 p-0"
          onClick={() => setDescExpanded(!descExpanded)}
        >
          <span className={`text-warm-600 text-sm ${descExpanded ? "" : "line-clamp-2"}`}>
            {description}
          </span>
          {description.length > 80 && (
            <span className="shrink-0 text-warm-400 mt-0.5">
              {descExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          )}
        </button>
      )}

      {/* Tags — horizontal scroll */}
      {recipe.tags && recipe.tags.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-3 -mx-1 px-1 pb-1">
          {recipe.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-warm-50 text-warm-600 text-xs font-semibold border border-warm-200 whitespace-nowrap shrink-0">
              <Tag size={11} /> {TAG_LABELS[tag] || tag}
            </span>
          ))}
        </div>
      )}

      {/* Badges */}
      <div className="flex gap-2 flex-wrap mb-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-50 text-primary-700 text-sm font-semibold border border-primary-200">
          <Clock size={14} /> {recipe.timeMin} min
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-50 text-accent-700 text-sm font-semibold border border-accent-200">
          <Coins size={14} /> {"€".repeat(recipe.costTier)}
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warm-100 text-warm-600 text-sm font-semibold border border-warm-200">
          <ChefHat size={14} /> {recipe.difficulty}
        </span>
      </div>

      {/* Context-specific actions */}
      {renderActions && renderActions()}

      <hr className="border-0 border-t border-warm-200 my-4" />

      {/* Ingredients */}
      <h3 className="text-sm font-extrabold text-warm-700 uppercase tracking-wide mb-2">Ingredientes</h3>
      <ul className="m-0 p-0 list-none grid gap-1.5">
        {recipe.ingredients.map((ing, idx) => (
          <li key={idx} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-warm-100 bg-warm-50">
            <span className="font-semibold text-warm-800">{ing.name[lang]}</span>
            <span className="text-warm-500 text-sm whitespace-nowrap">
              {(() => {
                const hf = settings.doublePortions ? ing.qty4Text : ing.qty2Text;
                const legacy = ing.qtyText ?? `${ing.qty ?? ""} ${ing.unit ?? ""}`.trim();
                return hf ?? legacy;
              })()}
              {ing.pantry ? " (despensa)" : ""}
            </span>
          </li>
        ))}
      </ul>

      {/* Info toggle (nutrition + allergens) */}
      {hasInfoData && (
        <div className="mt-4">
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${
              showInfo
                ? "bg-primary-600 text-white border-primary-600"
                : "bg-white text-warm-600 border-warm-200 hover:border-primary-300"
            }`}
            onClick={() => setShowInfo(!showInfo)}
          >
            <Info size={13} /> Info nutricional
          </button>

          {showInfo && (
            <div className="mt-2 space-y-3">
              {hasNutrition && (
                <div className="p-3 rounded-xl bg-warm-50 border border-warm-100">
                  <h3 className="text-xs font-extrabold text-warm-600 uppercase tracking-wide mb-2">Nutrición</h3>
                  <div className="flex gap-3 flex-wrap">
                    {recipe.nutrition!.calories != null && (
                      <span className="inline-flex items-center gap-1 text-sm text-warm-700 font-semibold">
                        <Flame size={13} className="text-orange-500" /> {Math.round(recipe.nutrition!.calories!)} kcal
                      </span>
                    )}
                    {recipe.nutrition!.protein != null && (
                      <span className="inline-flex items-center gap-1 text-sm text-warm-700 font-semibold">
                        <Beef size={13} className="text-red-500" /> {Math.round(recipe.nutrition!.protein!)}g prot
                      </span>
                    )}
                    {recipe.nutrition!.carbs != null && (
                      <span className="inline-flex items-center gap-1 text-sm text-warm-700 font-semibold">
                        <Wheat size={13} className="text-amber-500" /> {Math.round(recipe.nutrition!.carbs!)}g carb
                      </span>
                    )}
                    {recipe.nutrition!.fat != null && (
                      <span className="inline-flex items-center gap-1 text-sm text-warm-700 font-semibold">
                        <Droplets size={13} className="text-yellow-500" /> {Math.round(recipe.nutrition!.fat!)}g grasa
                      </span>
                    )}
                    {recipe.nutrition!.fiber != null && (
                      <span className="inline-flex items-center gap-1 text-sm text-warm-700 font-semibold">
                        <Leaf size={13} className="text-green-500" /> {Math.round(recipe.nutrition!.fiber!)}g fibra
                      </span>
                    )}
                  </div>
                </div>
              )}

              {hasAllergens && (
                <div>
                  <h3 className="text-xs font-extrabold text-warm-600 uppercase tracking-wide mb-2 inline-flex items-center gap-1">
                    <AlertTriangle size={12} /> Alérgenos
                  </h3>
                  <div className="flex gap-1.5 flex-wrap">
                    {recipe.allergens!.map((a) => (
                      <span key={a} className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Steps */}
      <h3 className="text-sm font-extrabold text-warm-700 uppercase tracking-wide mt-5 mb-3">Pasos</h3>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {recipe.steps[lang].map((s, idx) => {
          const lines = (s ?? "").split("\n").map(l => l.trim()).filter(Boolean);
          const title = lines[0] ?? `Paso ${idx + 1}`;
          const body = lines.slice(1);
          const stepImg = recipe.stepImages?.[idx];
          return (
            <div key={idx} className="border border-warm-200 rounded-2xl p-3 bg-white shadow-card min-h-[120px]">
              {stepImg && (
                <img src={stepImg} alt={title} className="w-full max-w-full h-32 object-cover rounded-xl mb-2" />
              )}
              <div className="flex items-center gap-3 mb-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-600 text-white flex items-center justify-center font-black text-sm shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0 font-extrabold text-warm-800 leading-tight">
                  <RichText text={title} />
                </div>
              </div>
              <div className="text-sm leading-relaxed text-warm-700">
                {renderStepBody(body)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
