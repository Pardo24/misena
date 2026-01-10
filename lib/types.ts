export type Lang = "es" | "ca";
export type Mode = "lazy" | "normal" | "chef";

export type Ingredient = {
  name: Record<Lang, string>;

  // ✅ formato actual (recetas manuales)
  qty?: number;           // opcional
  unit?: string;          // opcional
  qtyText?: string;       // opcional (ej: "200 g")

  // ✅ HelloFresh: cantidades por ración (2P / 4P)
  qty2Text?: string;      // ej: "140 gramos"
  qty4Text?: string;      // ej: "280 gramos"
  qty2?: number;          // opcional (si quieres cálculos)
  unit2?: string;         // opcional ("g", "ml", "u", etc.)
  qty4?: number;
  unit4?: string;

  pantry?: boolean;
  category?: string;
};

export type Recipe = {
  id: string;
  title: Record<Lang, string>;
  description: Record<Lang, string>;
  timeMin: number;
  costTier: 1 | 2 | 3;
  difficulty: "easy" | "normal";
  tags: string[];
  steps: Record<Lang, string[]>;
  ingredients: Ingredient[];
  active: 0 | 1;
};

export type Settings = {
  id: "singleton";
  lang: Lang;
  mode: Mode;
  doublePortions: boolean; // base 2 -> true => compra para 4
  householdSize: number;   // 2
  maxTimeMin: number;      // 25
  maxCostTier: 1 | 2 | 3;  // 2
  noRepeatDays: number;    // 12
};

export type HistoryEntry = {
  id?: number;
  recipeId: string;
  cookedAt: number;
};

export type PantryItem = {
  nameKey: string; // normalizado (es)
  alwaysHave: 0 | 1;
};

export type ShoppingItem = {
  key: string;
  name: string;
  category: string;
  checked: boolean;

  // legacy numérico
  qty?: number;
  unit?: string;

  // HelloFresh (texto)
  qtyText?: string;
};

