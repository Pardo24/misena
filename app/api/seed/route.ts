import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedRecipes } from "@/lib/seed";

function toDb(r: any) {
  return {
    id: String(r.id),
    title: r.title ?? { es: r.titleEs ?? "", ca: r.titleCa ?? "" },
    description: r.description ?? { es: r.descriptionEs ?? "", ca: r.descriptionCa ?? "" },
    mealType: r.mealType ?? "dinner",
    timeMin: Number.isFinite(r.timeMin) ? r.timeMin : 30,
    costTier: Number.isFinite(r.costTier) ? r.costTier : 2,
    difficulty: r.difficulty ?? "easy",
    tags: r.tags ?? [],
    active: r.active ?? true,
    ingredients: r.ingredients ?? [],
    steps: r.steps ?? { es: [], ca: [] },
  };
}

export async function POST() {
  const count = await prisma.recipe.count();
  if (count > 0) return NextResponse.json({ ok: true, seeded: false });

  for (const r of seedRecipes as any[]) {
    const data = toDb(r);

    await prisma.recipe.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  return NextResponse.json({ ok: true, seeded: true });
}
