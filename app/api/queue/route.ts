import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, getActiveHouseholdId } from "@/lib/server/household";

export const dynamic = "force-dynamic";

async function normalizePositions(householdId: string) {
  const items = await prisma.queueItem.findMany({
    where: { householdId },
    orderBy: { position: "asc" },
  });

  await prisma.$transaction(
    items.map((it, idx) =>
      prisma.queueItem.update({
        where: { id: it.id },
        data: { position: idx + 1 },
      })
    )
  );
}

export async function GET() {
  try {
    const { userId } = await requireUser();
    const householdId = await getActiveHouseholdId(userId);

    const items = await prisma.queueItem.findMany({
      where: { householdId },
      orderBy: { position: "asc" },
      include: { recipe: true },
    });

    return NextResponse.json(items.map(x => ({ recipeId: x.recipeId, recipe: x.recipe })));
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireUser();
    const householdId = await getActiveHouseholdId(userId);

    const { recipeId } = await req.json();
    if (!recipeId) return NextResponse.json({ error: "recipeId required" }, { status: 400 });

    const max = await prisma.queueItem.aggregate({
      where: { householdId },
      _max: { position: true },
    });

    const nextPos = (max._max.position ?? 0) + 1;

    await prisma.queueItem.upsert({
      where: { householdId_recipeId: { householdId, recipeId } },
      update: {},
      create: { householdId, recipeId, position: nextPos },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = await requireUser();
    const householdId = await getActiveHouseholdId(userId);

    const { searchParams } = new URL(req.url);
    const recipeId = searchParams.get("recipeId");
    if (!recipeId) return NextResponse.json({ error: "recipeId required" }, { status: 400 });

    await prisma.queueItem.deleteMany({ where: { householdId, recipeId } });
    await normalizePositions(householdId);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
}
