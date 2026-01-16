import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, getActiveHouseholdId } from "@/lib/server/household";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { userId } = await requireUser();
    const householdId = await getActiveHouseholdId(userId);

    const { recipeId, dir } = await req.json();
    if (!recipeId || (dir !== "up" && dir !== "down")) {
      return NextResponse.json({ error: "recipeId + dir(up|down) required" }, { status: 400 });
    }

    const current = await prisma.queueItem.findFirst({
      where: { householdId, recipeId },
    });
    if (!current) return NextResponse.json({ ok: true });

    const neighbor = await prisma.queueItem.findFirst({
      where: {
        householdId,
        position: dir === "up" ? { lt: current.position } : { gt: current.position },
      },
      orderBy: { position: dir === "up" ? "desc" : "asc" },
    });

    if (!neighbor) return NextResponse.json({ ok: true });

    await prisma.$transaction([
      prisma.queueItem.update({ where: { id: current.id }, data: { position: neighbor.position } }),
      prisma.queueItem.update({ where: { id: neighbor.id }, data: { position: current.position } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
}
