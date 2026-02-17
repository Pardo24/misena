export type Tab = "today" | "recipes" | "shop" | "plan" | "pantry" | "settings";

export type PantryRow = {
  id: string;
  nameKey: string;
  qty: number | null;
  unit: string | null;
  alwaysHave: boolean;
};

export type ShopItem = {
  key: string;
  name: string;
  checked: boolean;
  qtyText?: string | null;
  qty?: number | null;
  unit?: string | null;
};

export const CATEGORY_RULES: Array<{ key: string; title: string; words: string[] }> = [
  { key: "produce", title: "Fruta y verdura", words: ["tomate","cebolla","ajo","lechuga","pepino","zanahoria","patata","pimiento","plátano","banana","manzana","pera","limón","naranja","aguacate","espinaca","brocoli","brócoli","calabacin","calabacín","berenjena"] },
  { key: "meat", title: "Carne", words: ["pollo","ternera","cerdo","pavo","jamon","jamón","bacon","beicon","salchicha","carne picada"] },
  { key: "fish", title: "Pescado", words: ["salmon","salmón","atun","atún","bacalao","merluza","gambas","langostino","pescado"] },
  { key: "dairy", title: "Lácteos y huevos", words: ["leche","yogur","yogurt","queso","mantequilla","nata","huevo","huevos"] },
  { key: "carbs", title: "Arroz / pasta / pan", words: ["arroz","pasta","espagueti","espaguetis","macarron","macarrones","fideos","pan","harina","tortilla","wrap"] },
  { key: "cans", title: "Conservas", words: ["tomate frito","tomate triturado","garbanzos","lentejas","alubias","maiz","maíz","aceitunas","lata"] },
  { key: "spices", title: "Especias", words: ["sal","pimienta","pimenton","pimentón","comino","oregano","orégano","curcuma","cúrcuma","curry","canela","ajo en polvo"] },
  { key: "sauces", title: "Salsas y condimentos", words: ["aceite","vinagre","soja","mostaza","ketchup","mayonesa","salsa","pesto","tahini"] },
  { key: "nuts", title: "Frutos secos", words: ["nueces","almendra","cacahuete","anacardo","pistacho","avellana","semillas","chia","lino"] },
  { key: "other", title: "Otros", words: [] },
];

export function pickCategory(name: string) {
  const n = name.toLowerCase();
  for (const c of CATEGORY_RULES) {
    if (c.key === "other") continue;
    if (c.words.some((w) => n.includes(w))) return c.key;
  }
  return "other";
}

export function qtyLabel(it: ShopItem) {
  if (it.qtyText) return it.qtyText.trim();
  if (it.qty != null) {
    const q = Math.round(it.qty * 100) / 100;
    const u = (it.unit ?? "").trim();
    return u ? `${q} ${u}` : `${q}`;
  }
  return "";
}

export function lineLabel(it: ShopItem) {
  const q = qtyLabel(it);
  return q ? `${it.name} (${q})` : it.name;
}

export function groupItems(items: ShopItem[]) {
  const map = new Map<string, ShopItem[]>();
  for (const it of items) {
    const k = pickCategory(it.name);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(it);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => a.name.localeCompare(b.name));
  }
  const order = CATEGORY_RULES.map((c) => c.key);
  return order
    .filter((k) => map.has(k) && map.get(k)!.length)
    .map((k) => ({ key: k, title: CATEGORY_RULES.find((c) => c.key === k)!.title, items: map.get(k)! }));
}

export function groupsToText(groups: Array<{ title: string; items: ShopItem[] }>) {
  const out: string[] = [];
  for (const g of groups) {
    out.push(`## ${g.title}`);
    for (const it of g.items) out.push(`- ${lineLabel(it)}`);
    out.push("");
  }
  return out.join("\n").trim();
}

