"use client";

import { useState } from "react";
import type { Lang, Recipe, Settings, ShoppingItem } from "@/lib/types";
import {
  Clock, Coins, ChefHat, RefreshCw, ShoppingCart, Tag,
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

function renderStepBody(bodyLines: string[]) {
  return (
    <ul className="m-0 pl-4 grid gap-1.5">
      {bodyLines.map((raw, i) => {
        const line = raw.trim();
        if (!line) return null;
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
        const clean = line.startsWith("•") ? line.slice(1).trim() : line;
        return (
          <li key={i} className="text-warm-800 text-sm leading-relaxed list-disc">
            <RichText text={clean} />
          </li>
        );
      })}
    </ul>
  );
}

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
  const [showInfo, setShowInfo] = useState(false);
  const hasNutrition = today?.nutrition && Object.values(today.nutrition).some(Boolean);
  const hasAllergens = today?.allergens && today.allergens.length > 0;
  const hasInfoData = hasNutrition || hasAllergens;

  return (
    <section className="w-full max-w-[900px] bg-white border border-warm-200 rounded-2xl p-4 shadow-card">
      {todayLoading ? (
        <TodaySkeleton />
      ) : !today ? (
        <div className="text-warm-500 text-center py-8">{t.empty}</div>
      ) : (
        <div className={`transition-all duration-150 ${todayFadeIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1.5"}`}>
          {today.imageUrl && (
            <img
              src={today.imageUrl}
              alt={today.title[lang]}
              className="w-full rounded-xl mb-3 max-h-[400px] object-contain bg-warm-50"
            />
          )}
          <h2 className="text-xl font-extrabold text-warm-900 mb-1">{today.title[lang]}</h2>
          <p className="text-warm-600 text-sm mb-3">{today.description[lang]}</p>

          {/* Badges */}
          <div className="flex gap-2 flex-wrap mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-50 text-primary-700 text-sm font-semibold border border-primary-200">
              <Clock size={14} /> {today.timeMin} min
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-50 text-accent-700 text-sm font-semibold border border-accent-200">
              <Coins size={14} /> {"€".repeat(today.costTier)}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warm-100 text-warm-600 text-sm font-semibold border border-warm-200">
              <ChefHat size={14} /> {today.difficulty}
            </span>
            {settings.doublePortions && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-50 text-primary-700 text-sm font-semibold border border-primary-200">
                x2 sobras
              </span>
            )}
          </div>

          {/* Tags */}
          {today.tags && today.tags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mb-4">
              {today.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-warm-50 text-warm-600 text-xs font-semibold border border-warm-200">
                  <Tag size={11} /> {TAG_LABELS[tag] || tag}
                </span>
              ))}
            </div>
          )}

          {/* CTA Buttons */}
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

          <hr className="border-0 border-t border-warm-200 my-4" />

          {/* Ingredients */}
          <h3 className="text-sm font-extrabold text-warm-700 uppercase tracking-wide mb-2">Ingredientes</h3>
          <ul className="m-0 p-0 list-none grid gap-1.5">
            {today.ingredients.map((ing, idx) => (
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
                        {today.nutrition!.calories != null && (
                          <span className="inline-flex items-center gap-1 text-sm text-warm-700 font-semibold">
                            <Flame size={13} className="text-orange-500" /> {Math.round(today.nutrition!.calories!)} kcal
                          </span>
                        )}
                        {today.nutrition!.protein != null && (
                          <span className="inline-flex items-center gap-1 text-sm text-warm-700 font-semibold">
                            <Beef size={13} className="text-red-500" /> {Math.round(today.nutrition!.protein!)}g prot
                          </span>
                        )}
                        {today.nutrition!.carbs != null && (
                          <span className="inline-flex items-center gap-1 text-sm text-warm-700 font-semibold">
                            <Wheat size={13} className="text-amber-500" /> {Math.round(today.nutrition!.carbs!)}g carb
                          </span>
                        )}
                        {today.nutrition!.fat != null && (
                          <span className="inline-flex items-center gap-1 text-sm text-warm-700 font-semibold">
                            <Droplets size={13} className="text-yellow-500" /> {Math.round(today.nutrition!.fat!)}g grasa
                          </span>
                        )}
                        {today.nutrition!.fiber != null && (
                          <span className="inline-flex items-center gap-1 text-sm text-warm-700 font-semibold">
                            <Leaf size={13} className="text-green-500" /> {Math.round(today.nutrition!.fiber!)}g fibra
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
                        {today.allergens!.map((a) => (
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
            {today.steps[lang].map((s, idx) => {
              const lines = (s ?? "").split("\n").map(l => l.trim()).filter(Boolean);
              const title = lines[0] ?? `Paso ${idx + 1}`;
              const body = lines.slice(1);
              const stepImg = today.stepImages?.[idx];
              return (
                <div key={idx} className="border border-warm-200 rounded-2xl p-3 bg-white shadow-card min-h-[120px]">
                  {stepImg && (
                    <img src={stepImg} alt={title} className="w-full h-32 object-cover rounded-xl mb-2" />
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
