import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const recipes = await prisma.recipe.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(recipes);
}

export async function POST(req: Request) {
  const body = await req.json();

  // Si tu import genera IDs, perfecto. Si no, crea id aquí.
  const created = await prisma.recipe.create({ data: body });
  return NextResponse.json(created, { status: 201 });
}
