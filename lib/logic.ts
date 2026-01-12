import { db } from "./db";
import type { Mode, Recipe, ShoppingItem } from "./types";
import { defaultSettings, seedRecipes } from "./seed";

const normalize = (s: string) => s.trim().toLowerCase();


export async function getSettings() {
  return (await db.settings.get("singleton")) ?? defaultSettings;
}

export async function updateSettings(patch: Partial<typeof defaultSettings>) {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, id: "singleton" });
}

function modeMaxTime(mode: Mode, fallbackMax: number) {
  if (mode === "lazy") return Math.min(20, fallbackMax);
  if (mode === "normal") return Math.min(30, fallbackMax);
  return fallbackMax;
}

export function pickTodayRecipeFromList(
  recipes: Recipe[],
  recentRecipeIds: Set<string>,
  settings: { mode: any; maxTimeMin: number; maxCostTier: number }
): Recipe | null {
  const maxTime = modeMaxTime(settings.mode, settings.maxTimeMin);

  const eligible = recipes
    .filter(r => !!r.active)
    .filter(r => r.timeMin <= maxTime && r.costTier <= settings.maxCostTier);

  if (eligible.length === 0) return null;

  const candidates = eligible.filter(r => !recentRecipeIds.has(r.id));
  const pool = candidates.length ? candidates : eligible;

  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

export async function markCooked(recipeId: string) {
  await db.history.add({ recipeId, cookedAt: Date.now() });
}

export async function getPantrySet(): Promise<Set<string>> {
  const items = await db.pantry.toArray();
  return new Set(items.filter(i => i.alwaysHave).map(i => i.nameKey));
}

export async function setPantryItem(nameKey: string, alwaysHave: boolean) {
  await db.pantry.put({ nameKey, alwaysHave: alwaysHave ? 1 : 0 });
}

export async function buildShoppingList(recipe: Recipe): Promise<ShoppingItem[]> {
  const settings = await getSettings();
  const lang = settings.lang;
  const multiplier = settings.doublePortions ? 2 : 1; // base 2 -> compra 4
  const pantrySet = await getPantrySet();

  const map = new Map<string, ShoppingItem>();

  for (const ing of recipe.ingredients) {
    const name = ing.name?.[lang] || ing.name?.es || "";
    const nameKey = normalize(ing.name?.es || name);

    const isPantry = !!ing.pantry || pantrySet.has(nameKey);
    if (isPantry) continue;

    // --- HelloFresh: preferimos qty2Text/qty4Text (texto) ---
    const hfQtyText = settings.doublePortions ? ing.qty4Text : ing.qty2Text;
    if (hfQtyText) {
      const key = `${normalize(name)}|${hfQtyText}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          name,
          qtyText: hfQtyText,
          category: ing.category ?? "unknown",
          checked: false,
        });
      }
      continue;
    }

    // --- Legacy: qty numérico ---
    const qty = (ing.qty ?? 0) * multiplier;
    const unit = ing.unit ?? "";
    const key = `${normalize(name)}|${unit}`;

    const prev = map.get(key);
    if (prev) {
      prev.qty = (prev.qty ?? 0) + qty;
    } else {
      map.set(key, {
        key,
        name,
        qty,
        unit,
        category: ing.category ?? "unknown",
        checked: false,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.category.localeCompare(b.category));
}
