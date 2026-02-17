import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, getActiveHouseholdId } from "@/lib/server/household";

export const dynamic = "force-dynamic";

async function normalizePositions(householdId: string) {
  const items = await prisma.queueItem.findMany({
    where: { householdId },
    orderBy: { position: "asc" },
    select: { id: true },
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

export async function POST(req: Request) {
  try {
    const { userId } = await requireUser();
    const householdId = await getActiveHouseholdId(userId);

    const { recipeId, dir } = await req.json();
    if (!recipeId || (dir !== "up" && dir !== "down")) {
      return NextResponse.json({ error: "recipeId + dir(up|down) required" }, { status: 400 });
    }

    // ✅ evita estados raros (duplicados o huecos)
    await normalizePositions(householdId);

    const current = await prisma.queueItem.findFirst({
      where: { householdId, recipeId },
      select: { id: true, position: true },
    });
    if (!current) return NextResponse.json({ ok: true });

    const neighbor = await prisma.queueItem.findFirst({
      where: {
        householdId,
        position: dir === "up" ? { lt: current.position } : { gt: current.position },
      },
      orderBy: { position: dir === "up" ? "desc" : "asc" },
      select: { id: true, position: true },
    });
    if (!neighbor) return NextResponse.json({ ok: true });

    // ✅ swap robusto con "placeholder"
    await prisma.$transaction(async (tx) => {
      const temp = -999999; // fuera de rango
      await tx.queueItem.update({ where: { id: current.id }, data: { position: temp } });
      await tx.queueItem.update({ where: { id: neighbor.id }, data: { position: current.position } });
      await tx.queueItem.update({ where: { id: current.id }, data: { position: neighbor.position } });
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: "UNAUTHORIZED_OR_FAILED", detail: String(e?.message ?? "") },
      { status: 401 }
    );
  }
}
