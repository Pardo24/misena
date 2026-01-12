import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const items = await prisma.queueItem.findMany({
    orderBy: { position: "asc" },
    include: { recipe: true },
  });

  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const { recipeId } = await req.json();

  if (!recipeId) return NextResponse.json({ error: "recipeId required" }, { status: 400 });

  // si ya existe, no duplicar
  const exists = await prisma.queueItem.findUnique({ where: { recipeId } });
  if (exists) return NextResponse.json(exists);

  const agg = await prisma.queueItem.aggregate({ _max: { position: true } });
  const nextPos = (agg._max.position ?? 0) + 1;

  const item = await prisma.queueItem.create({
    data: { recipeId, position: nextPos },
    include: { recipe: true },
  });

  return NextResponse.json(item);
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const recipeId = url.searchParams.get("recipeId");
  if (!recipeId) return NextResponse.json({ error: "recipeId required" }, { status: 400 });

  await prisma.queueItem.delete({ where: { recipeId } });
  return NextResponse.json({ ok: true });
}
