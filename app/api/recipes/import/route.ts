import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type MealDBMeal = {
  idMeal: string;
  strMeal: string;
  strCategory: string;
  strArea: string;
  strInstructions: string;
  strMealThumb: string;
  strTags: string | null;
  [key: string]: string | null;
};

function parseMealIngredients(meal: MealDBMeal) {
  const ingredients: Array<{
    name: Record<string, string>;
    qtyText?: string;
  }> = [];

  for (let i = 1; i <= 20; i++) {
    const name = (meal[`strIngredient${i}`] ?? "").trim();
    const measure = (meal[`strMeasure${i}`] ?? "").trim();
    if (!name) continue;

    ingredients.push({
      name: { es: name, ca: name },
      ...(measure ? { qtyText: measure } : {}),
    });
  }

  return ingredients;
}

function parseSteps(instructions: string): string[] {
  return instructions
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz";

export async function POST() {
  let totalImported = 0;
  const errors: string[] = [];

  for (const letter of ALPHABET) {
    try {
      const res = await fetch(
        `https://www.themealdb.com/api/json/v1/1/search.php?f=${letter}`
      );
      if (!res.ok) {
        errors.push(`Letter ${letter}: HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const meals: MealDBMeal[] = data.meals ?? [];

      for (const meal of meals) {
        const id = `mealdb-${meal.idMeal}`;
        const title = { es: meal.strMeal, ca: meal.strMeal };
        const description = {
          es: `${meal.strCategory} - ${meal.strArea}`,
          ca: `${meal.strCategory} - ${meal.strArea}`,
        };
        const ingredients = parseMealIngredients(meal);
        const steps = {
          es: parseSteps(meal.strInstructions),
          ca: parseSteps(meal.strInstructions),
        };
        const tags = [
          meal.strCategory,
          meal.strArea,
          ...(meal.strTags?.split(",").map((t) => t.trim()) ?? []),
        ].filter(Boolean);

        await prisma.recipe.upsert({
          where: { id },
          create: {
            id,
            title,
            description,
            mealType: meal.strCategory?.toLowerCase().includes("dessert")
              ? "dessert"
              : "main",
            timeMin: 30,
            costTier: 2,
            difficulty: "normal",
            tags,
            ingredients,
            steps,
            imageUrl: meal.strMealThumb || null,
            active: true,
          },
          update: {
            title,
            description,
            tags,
            ingredients,
            steps,
            imageUrl: meal.strMealThumb || null,
          },
        });
        totalImported++;
      }
    } catch (e: any) {
      errors.push(`Letter ${letter}: ${e.message}`);
    }
  }

  return NextResponse.json({
    ok: true,
    imported: totalImported,
    errors: errors.length > 0 ? errors : undefined,
  });
}
