import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  listRecipes,
  getMenu,
  getRecipeDetail,
  scrapeRecipePage,
  type HfreshRecipeListItem,
} from "@/lib/hfresh";
import { normalizeHfreshTags, classifyByIngredients, mergeTags } from "@/lib/hfresh-tags";
import type { Ingredient } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function mapDifficulty(d: number): "easy" | "normal" {
  return d <= 1 ? "easy" : "normal";
}

function mapCostTier(item: HfreshRecipeListItem): 1 | 2 | 3 {
  if (item.label?.name?.toLowerCase().includes("premium")) return 3;
  return 2;
}

function mapIngredientsFromApi(ingredients: Array<{ id: number; name: string }>): Ingredient[] {
  return (ingredients || []).map((ing) => ({
    name: { es: ing.name, ca: ing.name },
    category: "unknown" as string,
  }));
}

/**
 * Build ingredients from scraped JSON-LD data (with quantities).
 * recipeYield is the base serving size (usually 2).
 * We compute qty for 2, 4, and 6 persons.
 */
function mapIngredientsFromScrape(
  scraped: Array<{ name: string; qty: number | null; unit: string | null; raw: string }>,
  recipeYield: number,
): Ingredient[] {
  return scraped.map((s) => {
    const baseQty = s.qty;
    const unit = s.unit || undefined;

    // Scale factor from base yield to target servings
    const factor2 = 2 / recipeYield;
    const factor4 = 4 / recipeYield;
    const factor6 = 6 / recipeYield;

    const fmt = (q: number, u?: string) => {
      const rounded = Math.round(q * 10) / 10;
      const display = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
      return u ? `${display} ${u}` : display;
    };

    const ing: Ingredient = {
      name: { es: s.name, ca: s.name },
      category: "unknown",
    };

    if (baseQty != null) {
      // Numeric quantities for calculations
      ing.qty2 = Math.round(baseQty * factor2 * 10) / 10;
      ing.unit2 = unit;
      ing.qty4 = Math.round(baseQty * factor4 * 10) / 10;
      ing.unit4 = unit;

      // Text quantities for display
      ing.qty2Text = fmt(baseQty * factor2, unit);
      ing.qty4Text = fmt(baseQty * factor4, unit);

      // Legacy fields (default to 2-person)
      ing.qty = ing.qty2;
      ing.unit = unit;
      ing.qtyText = ing.qty2Text;
    }

    return ing;
  });
}

function mapNutrition(items: Array<{ name: string; unit: string; amount: number }>) {
  if (!items?.length) return undefined;
  const find = (keyword: string) => items.find((i) => i.name.toLowerCase().includes(keyword))?.amount;
  const nutrition: Record<string, number> = {};
  const cal = find("kcal"); if (cal != null) nutrition.calories = cal;
  const fat = find("grasa"); if (fat != null) nutrition.fat = fat;
  const protein = find("proteína"); if (protein != null) nutrition.protein = protein;
  const carbs = find("carbohidrato"); if (carbs != null) nutrition.carbs = carbs;
  const fiber = find("fibra"); if (fiber != null) nutrition.fiber = fiber;
  return Object.keys(nutrition).length > 0 ? nutrition : undefined;
}

export async function POST(req: Request) {
  if (!process.env.HFRESH_API_TOKEN) {
    return NextResponse.json({ error: "HFRESH_API_TOKEN missing" }, { status: 500 });
  }

  const url = new URL(req.url);
  const menu = url.searchParams.get("menu"); // YYYYWW format
  const pageNum = parseInt(url.searchParams.get("page") || "1");
  const perPage = Math.min(parseInt(url.searchParams.get("perPage") || "50"), 200);
  const search = url.searchParams.get("search") || undefined;
  const tag = url.searchParams.get("tag") ? parseInt(url.searchParams.get("tag")!) : undefined;

  // Get recipe list: from menu or from general listing
  let items: HfreshRecipeListItem[];
  let meta = { current_page: 1, last_page: 1, total: 0 };

  if (menu) {
    const menuData = await getMenu(menu);
    items = menuData.recipes || [];
    meta.total = items.length;
  } else {
    const listing = await listRecipes({ page: pageNum, perPage, search, tag });
    items = listing.data;
    meta = listing.meta;
  }

  let imported = 0;
  let skipped = 0;
  const failed: Array<{ id: number; name: string; reason: string }> = [];

  for (const item of items) {
    const recipeId = `hf-${item.canonical_id || item.id}`;

    // Check if already imported
    const exists = await prisma.recipe.findUnique({ where: { id: recipeId }, select: { id: true } });
    if (exists) {
      skipped++;
      continue;
    }

    try {
      // Get full detail from API
      const detail = await getRecipeDetail(item.id);

      // Scrape HelloFresh page for steps and images
      const scraped = await scrapeRecipePage(item.url);

      // Map ingredients: prefer scraped data (has quantities) over API data (name only)
      const ingredients = scraped.ingredients.length > 0
        ? mapIngredientsFromScrape(scraped.ingredients, scraped.recipeYield)
        : mapIngredientsFromApi(detail.ingredients);

      // Build tags
      const hfreshTagNames = (detail.tags || []).map((t) => t.name);
      const hfTags = normalizeHfreshTags(hfreshTagNames);
      const ingredientTags = classifyByIngredients(ingredients);
      const tags = mergeTags([], hfTags, ingredientTags);

      // Map steps - use scraped data, fallback to empty
      const steps = scraped.steps.length > 0
        ? { es: scraped.steps, ca: scraped.steps }
        : { es: [] as string[], ca: [] as string[] };

      // Map nutrition
      const nutrition = mapNutrition(detail.nutrition);

      // Map allergens
      const allergens = detail.allergens?.length
        ? detail.allergens.map((a) => a.name)
        : undefined;

      await prisma.recipe.create({
        data: {
          id: recipeId,
          title: { es: item.name, ca: item.name },
          description: {
            es: detail.description || item.headline || "",
            ca: detail.description || item.headline || "",
          },
          mealType: "main",
          timeMin: item.total_time || item.prep_time || 30,
          costTier: mapCostTier(item),
          difficulty: mapDifficulty(item.difficulty),
          tags,
          active: true,
          ingredients,
          steps,
          imageUrl: scraped.ogImage || null,
          stepImages: scraped.stepImages.length > 0 ? scraped.stepImages : undefined,
          nutrition,
          allergens,
          source: "hfresh",
          sourceId: String(item.canonical_id || item.id),
        },
      });

      imported++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      failed.push({ id: item.id, name: item.name, reason: message });
    }

    await sleep(500);
  }

  return NextResponse.json({
    ok: true,
    page: meta.current_page,
    totalPages: meta.last_page,
    totalRecipes: meta.total,
    imported,
    skipped,
    failed: failed.length > 0 ? failed : undefined,
  });
}
