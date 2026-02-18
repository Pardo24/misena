/**
 * hfresh.info API client with rate limiting and HelloFresh page scraping.
 */

const HFRESH_API_TOKEN = process.env.HFRESH_API_TOKEN!;
const BASE = "https://api.hfresh.info";
const DEFAULT_LOCALE = "es-ES";
const RATE_LIMIT_DELAY_MS = 1100; // ~54 req/min, under 60/min limit

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Rate-limited fetch with retry on 429 ──

let lastRequestAt = 0;

async function rateLimitedFetch(url: string, init?: RequestInit): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < RATE_LIMIT_DELAY_MS) {
    await sleep(RATE_LIMIT_DELAY_MS - elapsed);
  }
  lastRequestAt = Date.now();

  let wait = 800;
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, init);
    if (res.status !== 429) return res;
    await sleep(wait);
    wait *= 2;
  }
  return fetch(url, init);
}

// ── API calls ──

export type HfreshTag = { id: number; name: string };
export type HfreshAllergen = { id: number; name: string };

export type HfreshRecipeListItem = {
  id: number;
  canonical_id: number | null;
  published: boolean;
  url: string;
  name: string;
  headline: string;
  difficulty: number;
  prep_time: number;
  total_time: number;
  has_pdf: boolean;
  label: { id: number; name: string } | null;
  tags: HfreshTag[];
};

export type HfreshNutritionItem = {
  name: string;
  type: string;
  unit: string;
  amount: number;
};

export type HfreshRecipeDetail = HfreshRecipeListItem & {
  description: string;
  pdf_url: string | null;
  nutrition: HfreshNutritionItem[];
  allergens: HfreshAllergen[];
  ingredients: Array<{ id: number; name: string }>;
  cuisines: Array<{ id: number; name: string }>;
  utensils: Array<{ id: number; name: string }>;
};

export type HfreshPaginatedResponse<T> = {
  data: T[];
  meta: {
    current_page: number;
    from: number;
    last_page: number;
    per_page: number;
    to: number;
    total: number;
  };
};

function authHeaders() {
  return {
    Authorization: `Bearer ${HFRESH_API_TOKEN}`,
    Accept: "application/json",
  };
}

export async function fetchHfresh<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}/${DEFAULT_LOCALE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await rateLimitedFetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) throw new Error(`hfresh ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function searchRecipes(
  query: string,
  opts?: { perPage?: number; page?: number; tag?: number }
): Promise<HfreshPaginatedResponse<HfreshRecipeListItem>> {
  const params: Record<string, string> = {
    search: query,
    per_page: String(opts?.perPage ?? 50),
  };
  if (opts?.page) params.page = String(opts.page);
  if (opts?.tag) params.tag = String(opts.tag);
  return fetchHfresh("/recipes", params);
}

export async function listRecipes(
  opts?: { perPage?: number; page?: number; tag?: number; search?: string }
): Promise<HfreshPaginatedResponse<HfreshRecipeListItem>> {
  const params: Record<string, string> = {
    per_page: String(opts?.perPage ?? 50),
  };
  if (opts?.page) params.page = String(opts.page);
  if (opts?.tag) params.tag = String(opts.tag);
  if (opts?.search) params.search = opts.search;
  return fetchHfresh("/recipes", params);
}

export async function getRecipeDetail(id: number): Promise<HfreshRecipeDetail> {
  const res = await fetchHfresh<{ data: HfreshRecipeDetail }>(`/recipes/${id}`);
  return res.data;
}

export async function getTags(): Promise<HfreshTag[]> {
  const res = await fetchHfresh<HfreshPaginatedResponse<HfreshTag>>("/tags", { per_page: "200" });
  return res.data;
}

export async function getAllergens(): Promise<HfreshAllergen[]> {
  const res = await fetchHfresh<HfreshPaginatedResponse<HfreshAllergen>>("/allergens", { per_page: "200" });
  return res.data;
}

export type HfreshMenu = {
  id: number;
  url: string;
  year_week: number;
  start: string;
  recipes: HfreshRecipeListItem[];
};

export async function getMenu(yearWeek: string): Promise<HfreshMenu> {
  return fetchHfresh(`/menus/${yearWeek}`, { include_recipes: "true" });
}

// ── HelloFresh page scraping ──

export type ScrapedIngredient = {
  name: string;
  qty: number | null;
  unit: string | null;
  raw: string; // original string e.g. "250 gramo(s) Muslos de pollo"
};

export type ScrapedPageData = {
  ogImage: string | null;
  stepImages: string[];
  steps: string[]; // formatted as "Title\n• Bullet 1\n• Bullet 2"
  ingredients: ScrapedIngredient[];
  recipeYield: number; // base serving size (usually 2)
  status: number;
};

function absolutize(url: string, base: string): string {
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

function extractJsonLd(html: string): unknown[] {
  const arr = [...html.matchAll(/<script[^>]+ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  const out: unknown[] = [];
  for (const m of arr) {
    try {
      const j = JSON.parse(m[1]);
      Array.isArray(j) ? out.push(...j) : out.push(j);
    } catch { /* skip malformed */ }
  }
  return out;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function scrapeRecipePage(url: string): Promise<ScrapedPageData> {
  const res = await rateLimitedFetch(url, {
    headers: { "user-agent": "Mozilla/5.0", accept: "text/html" },
  });

  if (!res.ok) return { ogImage: null, stepImages: [], steps: [], ingredients: [], recipeYield: 2, status: res.status };

  let html = await res.text();

  // If this is an hfresh.info page (no JSON-LD), find the hellofresh.es link and scrape that instead
  if (!html.includes("ld+json") && url.includes("hfresh.info")) {
    const hfLink = html.match(/href=["'](https?:\/\/[^"']*hellofresh\.[^"']*\/recipes\/[^"']+)["']/i);
    if (hfLink) {
      const hfRes = await rateLimitedFetch(hfLink[1], {
        headers: { "user-agent": "Mozilla/5.0", accept: "text/html" },
      });
      if (hfRes.ok) {
        html = await hfRes.text();
        url = hfLink[1];
      }
    }
  }

  // og:image
  const ogImage =
    html.match(/property=["']og:image["'][^>]*content=["']([^"']+)/i)?.[1] ||
    html.match(/content=["']([^"']+)[^>]*property=["']og:image/i)?.[1] ||
    null;

  const ld = extractJsonLd(html);
  const stepImages: string[] = [];
  const steps: string[] = [];
  const ingredients: ScrapedIngredient[] = [];
  let recipeYield = 2;

  for (const r of ld as any[]) {
    if (r["@type"] === "Recipe" || r["@type"]?.includes?.("Recipe")) {
      // Yield
      if (typeof r.recipeYield === "number") recipeYield = r.recipeYield;
      else if (typeof r.recipeYield === "string") recipeYield = parseInt(r.recipeYield) || 2;

      // Ingredients from JSON-LD
      if (Array.isArray(r.recipeIngredient)) {
        for (const raw of r.recipeIngredient as string[]) {
          ingredients.push(parseIngredientString(raw));
        }
      }

      // Instructions
      const instructions = r.recipeInstructions;
      if (!Array.isArray(instructions)) continue;

      for (let i = 0; i < instructions.length; i++) {
        const s = instructions[i];
        // Step text
        const title = s?.name || `Paso ${i + 1}`;
        const rawText = (s?.text || "").replace(/<[^>]+>/g, "").trim();
        const bullets = rawText
          .split(/(?<=\.)\s+/)
          .filter((b: string) => b.trim())
          .map((b: string) => `• ${b.trim()}`);
        steps.push([title, ...bullets].join("\n"));

        // Step image
        let img: string | null = null;
        if (typeof s?.image === "string") img = absolutize(s.image, url);
        else if (Array.isArray(s?.image) && s.image[0]) img = absolutize(s.image[0], url);
        else if (s?.image?.url) img = absolutize(s.image.url, url);
        stepImages.push(img || "");
      }
      break;
    }
  }

  return { ogImage, stepImages, steps, ingredients, recipeYield, status: res.status };
}

// ── Ingredient string parser ──
// Parses strings like "250 gramo(s) Muslos de pollo" or "1 unidad(es) Cebolla"

const UNIT_MAP: Record<string, string> = {
  "gramo(s)": "g", "gramos": "g", "g": "g",
  "mililitro(s)": "ml", "mililitros": "ml", "ml": "ml",
  "litro(s)": "L", "litros": "L",
  "unidad(es)": "u", "unidades": "u", "unidad": "u",
  "sobre(s)": "sobre", "sobres": "sobre",
  "cucharada(s)": "cda", "cucharadas": "cda", "cucharada": "cda",
  "cucharadita(s)": "cdta", "cucharaditas": "cdta", "cucharadita": "cdta",
  "pizca(s)": "pizca", "pizcas": "pizca", "pizca": "pizca",
  "rodaja(s)": "rodaja", "rodajas": "rodaja",
  "diente(s)": "diente", "dientes": "diente",
  "manojo(s)": "manojo", "manojos": "manojo",
  "rebanada(s)": "rebanada", "rebanadas": "rebanada",
  "lata(s)": "lata", "latas": "lata",
};

function parseIngredientString(raw: string): ScrapedIngredient {
  const trimmed = raw.trim();
  // Pattern: "250 gramo(s) Name" or "1 unidad(es) Name" or "½ cucharada(s) Name"
  const m = trimmed.match(/^([\d.,½¼¾⅓⅔]+)\s+(\S+)\s+(.+)$/);
  if (!m) {
    return { name: trimmed, qty: null, unit: null, raw: trimmed };
  }

  let qtyStr = m[1].replace(",", ".");
  // Handle fraction chars
  const fractions: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 0.333, "⅔": 0.667 };
  const qty = fractions[qtyStr] ?? parseFloat(qtyStr);
  const unitRaw = m[2].toLowerCase();
  const unit = UNIT_MAP[unitRaw] || unitRaw;
  const name = m[3].trim();

  return { name, qty: isNaN(qty) ? null : qty, unit, raw: trimmed };
}

// ── Search helpers ──

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeForSearch(s: string): string {
  return stripAccents(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")    .trim();
}

function maybeFixMojibake(s: string): string {
  if (!/[Ã]/.test(s)) return s;
  try {
    return Buffer.from(s, "latin1").toString("utf8");
  } catch {
    return s;
  }
}

export function buildCandidateQueries(title: string): string[] {
  const t1 = title.trim();
  const t2 = maybeFixMojibake(t1);
  const t3 = stripAccents(t2);
  const base = normalizeForSearch(t3)
    .replace(/\b(con|de|al|a la|en|y|e|del|los|las|el|la|un|una)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = base.split(" ").filter(Boolean);
  const short5 = words.slice(0, 5).join(" ");
  const short3 = words.slice(0, 3).join(" ");
  return Array.from(new Set([t1, t2, t3, base, short5, short3].filter(Boolean)));
}

export function scoreMatch(query: string, candidate: string): number {
  const qs = normalizeForSearch(query).split(" ");
  const cs = normalizeForSearch(candidate);
  let s = 0;
  for (const w of qs) if (cs.includes(w)) s++;
  return s / Math.max(qs.length, 1);
}
