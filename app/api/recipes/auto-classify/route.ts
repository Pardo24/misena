import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyByIngredients, classifyByTitle, mergeTags } from "@/lib/hfresh-tags";
import type { Ingredient } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const ids = url.searchParams.get("ids")?.split(",").filter(Boolean);
  const dryRun = url.searchParams.get("dryRun") === "true";

  const where = ids?.length ? { id: { in: ids } } : {};

  const recipes = await prisma.recipe.findMany({
    where,
    select: { id: true, title: true, tags: true, ingredients: true },
  });

  const changes: Array<{ id: string; oldTags: string[]; newTags: string[] }> = [];

  for (const r of recipes) {
    const title = r.title as Record<string, string>;
    const ingredients = r.ingredients as Ingredient[];
    const oldTags = (r.tags as string[]) || [];

    const byIngredients = classifyByIngredients(ingredients);
    const byTitle = classifyByTitle(title);
    const newTags = mergeTags(oldTags, byIngredients, byTitle);

    // Only update if tags changed
    if (newTags.length !== oldTags.length || newTags.some((t) => !oldTags.includes(t))) {
      changes.push({ id: r.id, oldTags, newTags });

      if (!dryRun) {
        await prisma.recipe.update({
          where: { id: r.id },
          data: { tags: newTags },
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    total: recipes.length,
    classified: changes.length,
    dryRun,
    changes: changes.slice(0, 100), // limit response size
  });
}
