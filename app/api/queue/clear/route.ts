import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, getActiveHouseholdId } from "@/lib/server/household";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { userId } = await requireUser();
    const householdId = await getActiveHouseholdId(userId);

    await prisma.queueItem.deleteMany({ where: { householdId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
}
