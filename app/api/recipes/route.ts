import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const recipes = await prisma.recipe.findMany({
    where: { active: true },
    orderBy: { updatedAt: "desc" },
  });

  // Prisma devuelve Json como unknown => lo devolvemos tal cual
  return NextResponse.json(recipes);
}
