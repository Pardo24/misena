import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRecipeDetail, scrapeRecipePage } from "@/lib/hfresh";
import type { Ingredient } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function hasQuantities(ingredients: Ingredient[]): boolean {
  return ingredients.some((i) => i.qty2Text || i.qty4Text || (i.qty != null && i.qty > 0));
}

function scaleIngredients(
  scraped: Array<{ name: string; qty: number | null; unit: string | null; raw: string }>,
  recipeYield: number,
  existingIngredients: Ingredient[],
): Ingredient[] {
  const fmt = (q: number, u?: string) => {
    const rounded = Math.round(q * 10) / 10;
    const display = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
    return u ? `${display} ${u}` : display;
  };

  return scraped.map((s) => {
    const factor2 = 2 / recipeYield;
    const factor4 = 4 / recipeYield;

    // Try to find matching existing ingredient (for category, pantry, etc.)
    const existing = existingIngredients.find((e) => {
      const eName = (e.name?.es || "").toLowerCase();
      return eName === s.name.toLowerCase() || s.name.toLowerCase().includes(eName) || eName.includes(s.name.toLowerCase());
    });

    const ing: Ingredient = {
      name: existing?.name || { es: s.name, ca: s.name },
      category: existing?.category || "unknown",
      pantry: existing?.pantry,
    };

    if (s.qty != null) {
      ing.qty2 = Math.round(s.qty * factor2 * 10) / 10;
      ing.unit2 = s.unit || undefined;
      ing.qty4 = Math.round(s.qty * factor4 * 10) / 10;
      ing.unit4 = s.unit || undefined;
      ing.qty2Text = fmt(s.qty * factor2, s.unit || undefined);
      ing.qty4Text = fmt(s.qty * factor4, s.unit || undefined);
      ing.qty = ing.qty2;
      ing.unit = s.unit || undefined;
      ing.qtyText = ing.qty2Text;
    }

    return ing;
  });
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "0") || 0;

  // Find all HF recipes missing quantities
  const recipes = await prisma.recipe.findMany({
    where: { source: "hfresh" },
    select: { id: true, title: true, ingredients: true, source: true, sourceId: true },
  });

  const allNeedsUpdate = recipes.filter((r) => {
    const ings = (r.ingredients as Ingredient[]) || [];
    return !hasQuantities(ings);
  });

  const needsUpdate = limit > 0 ? allNeedsUpdate.slice(0, limit) : allNeedsUpdate;

  if (needsUpdate.length === 0) {
    return NextResponse.json({ ok: true, message: "All HF recipes already have quantities", total: recipes.length, updated: 0 });
  }

  // Stream NDJSON for real-time progress
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };

      send({ event: "start", total: recipes.length, needsUpdate: needsUpdate.length });

      let updated = 0;
      const failed: Array<{ id: string; name: string; reason: string }> = [];

      for (let i = 0; i < needsUpdate.length; i++) {
        const r = needsUpdate[i];
        const title = r.title as Record<string, string>;
        const titleRaw = title.es || title.ca || "";

        try {
          if (!r.sourceId) {
            failed.push({ id: r.id, name: titleRaw, reason: "NO_SOURCE_ID" });
            send({ event: "skip", i: i + 1, name: titleRaw, reason: "NO_SOURCE_ID" });
            continue;
          }

          const detail = await getRecipeDetail(parseInt(r.sourceId));
          if (!detail.url) {
            failed.push({ id: r.id, name: titleRaw, reason: "NO_URL_IN_DETAIL" });
            send({ event: "skip", i: i + 1, name: titleRaw, reason: "NO_URL_IN_DETAIL" });
            continue;
          }

          const page = await scrapeRecipePage(detail.url);
          if (page.ingredients.length === 0) {
            failed.push({ id: r.id, name: titleRaw, reason: "NO_INGREDIENTS_SCRAPED" });
            send({ event: "skip", i: i + 1, name: titleRaw, reason: "NO_INGREDIENTS_SCRAPED" });
            continue;
          }

          const existingIngs = (r.ingredients as Ingredient[]) || [];
          const newIngredients = scaleIngredients(page.ingredients, page.recipeYield, existingIngs);

          await prisma.recipe.update({
            where: { id: r.id },
            data: { ingredients: newIngredients as any },
          });

          updated++;
          send({ event: "ok", i: i + 1, name: titleRaw, ingredients: page.ingredients.length });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          failed.push({ id: r.id, name: titleRaw, reason: message });
          send({ event: "error", i: i + 1, name: titleRaw, reason: message });
        }

        await sleep(800);
      }

      send({ event: "done", total: recipes.length, needsUpdate: needsUpdate.length, updated, failedCount: failed.length });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Transfer-Encoding": "chunked" },
  });
}
