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


function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeIngredientName(name: string) {
  let s = stripAccents(name)
    .toLowerCase()
    .replace(/\*\*/g, "")
    .replace(/[\(\[].*?[\)\]]/g, " ")   // (ver cantidad...) etc
    .replace(/\s+/g, " ")
    .trim();

  // 🔥 Reglas duras (colapsa variantes)
  if (s.includes("agua")) return "agua";
  if (s.includes("aceite")) return "aceite";
  if (s.includes("sal")) return "sal";
  if (s.includes("pimienta")) return "pimienta";
  if (s.includes("mantequilla")) return "mantequilla";
  if (s.includes("vinagre")) return "vinagre";

  // Quita “para la salsa / para el arroz / ...” si te interesa generalizar otros
  s = s.replace(/\bpara\b.*$/, "").trim();

  // Quita artículos sueltos al final
  s = s.replace(/\b(el|la|los|las|de|del|al)\b/g, " ").replace(/\s+/g, " ").trim();

  return s;
}

export const ALWAYS_IGNORE = new Set([
  "agua", "aceite", "sal", "pimienta", "mantequilla", "vinagre",
]);

export async function buildShoppingListForMany(recipes: Recipe[], settings: any) {
  const pantrySet = await getPantrySet();
  const map = new Map<string, ShoppingItem>();

  for (const r of recipes) {
    const items = await buildShoppingList(r, settings, pantrySet);

    for (const it of items) {
      const prev = map.get(it.key);
      if (!prev) map.set(it.key, { ...it, checked: false });
      else {
        if (prev.qty != null && it.qty != null) prev.qty += it.qty;
        // qtyText: por simplicidad, dejamos el primero
      }
    }
  }

  return Array.from(map.values());
}


export function toIdSet(queue: { recipeId: string }[]) {
  return new Set(queue.map(q => q.recipeId).filter(Boolean));
}


export async function buildShoppingList(
  recipe: Recipe,
  settingsOverride?: Awaited<ReturnType<typeof getSettings>>,
  pantryOverride?: Set<string>
): Promise<ShoppingItem[]> {
  const settings = settingsOverride ?? (await getSettings());
  const pantrySet = pantryOverride ?? (await getPantrySet());
  const lang = settings.lang;
  const multiplier = settings.doublePortions ? 2 : 1;

  const map = new Map<string, ShoppingItem>();

  for (const ing of recipe.ingredients as any[]) {
    const displayName = (ing.name?.[lang] || ing.name?.es || "").trim();
    if (!displayName) continue;

    const baseKey = normalizeIngredientName(displayName);
    if (ALWAYS_IGNORE.has(baseKey)) continue;

    const isPantry = !!ing.pantry || pantrySet.has(baseKey);
    if (isPantry) continue;

    const hfQtyText = settings.doublePortions ? ing.qty4Text : ing.qty2Text;

    if (hfQtyText) {
      if (!map.has(baseKey)) {
        map.set(baseKey, {
          key: baseKey,
          name: displayName,
          qtyText: hfQtyText,
          category: ing.category ?? "unknown",
          checked: false,
        } as any);
      }
      continue;
    }

    const qty = (ing.qty ?? 0) * multiplier;
    const unit = (ing.unit ?? "").trim();
    if (!qty) continue;

    const prev = map.get(baseKey);
    if (prev) {
      if (prev.qty != null) prev.qty = (prev.qty ?? 0) + qty;
    } else {
      map.set(baseKey, {
        key: baseKey,
        name: displayName,
        qty,
        unit,
        category: ing.category ?? "unknown",
        checked: false,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.category.localeCompare(b.category));
}
