"use client";

import { useEffect } from "react";
import type { Lang, Recipe, Settings } from "@/lib/types";
import { RecipeDetailView } from "@/components/RecipeDetailView";
import { X, Plus, Check, ChefHat } from "lucide-react";

type Props = {
  recipe: Recipe;
  settings: Settings;
  lang: Lang;
  inQueue: boolean;
  onToggleQueue: () => void;
  onCook: () => void;
  onClose: () => void;
};

export function RecipeDetailModal({ recipe, settings, lang, inQueue, onToggleQueue, onCook, onClose }: Props) {
  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-[640px] mx-3 my-6 bg-white rounded-2xl shadow-fab overflow-hidden">
        {/* Close button */}
        <button
          type="button"
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/80 backdrop-blur border border-warm-200 flex items-center justify-center cursor-pointer text-warm-600 hover:text-warm-900"
          onClick={onClose}
        >
          <X size={18} />
        </button>

        {/* Content */}
        <div className="p-4 pb-28">
          <RecipeDetailView
            recipe={recipe}
            settings={settings}
            lang={lang}
          />
        </div>

        {/* Bottom action bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-warm-200 px-4 py-3 flex gap-2">
          <button
            type="button"
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm cursor-pointer border-0 min-h-[48px] transition-colors ${
              inQueue
                ? "bg-primary-600 text-white"
                : "bg-primary-600 text-white hover:bg-primary-700"
            }`}
            onClick={onToggleQueue}
          >
            {inQueue ? <><Check size={16} /> En el plan</> : <><Plus size={16} /> Añadir al plan</>}
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-warm-300 bg-white text-warm-700 font-bold text-sm hover:border-warm-400 cursor-pointer min-h-[48px]"
            onClick={onCook}
          >
            <ChefHat size={16} /> Cocinar
          </button>
        </div>
      </div>
    </div>
  );
}
