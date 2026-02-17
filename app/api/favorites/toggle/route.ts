import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server/me";

export async function POST(req: Request) {
  const me = await requireUser();
  if (!me) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const recipeId = String(body?.recipeId ?? "").trim();
  if (!recipeId) return NextResponse.json({ error: "RECIPE_ID_REQUIRED" }, { status: 400 });

  const existing = await prisma.favorite.findUnique({
    where: { userId_recipeId: { userId: me.id, recipeId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true, favorited: false });
  }

  await prisma.favorite.create({
    data: { userId: me.id, recipeId },
  });

  return NextResponse.json({ ok: true, favorited: true });
}
