import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server/me";

export async function GET() {
  const me = await requireUser();
  if (!me) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const favs = await prisma.favorite.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: "desc" },
    select: { recipeId: true, createdAt: true },
  });

  // Como Favorite no relaciona a Recipe, hacemos lookup manual
  const ids = favs.map(f => f.recipeId);
  const recipes = ids.length
    ? await prisma.recipe.findMany({
        where: { id: { in: ids } },
        select: { id: true, title: true, description: true, timeMin: true, costTier: true, active: true },
      })
    : [];

  const map = new Map(recipes.map(r => [r.id, r]));
  return NextResponse.json({
    favorites: favs.map(f => ({
      recipeId: f.recipeId,
      createdAt: f.createdAt,
      recipe: map.get(f.recipeId) ?? null,
    })),
  });
}
