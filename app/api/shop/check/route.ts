import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, getActiveHouseholdId } from "@/lib/server/household";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { userId } = await requireUser();
    const householdId = await getActiveHouseholdId(userId);

    const { key, checked } = await req.json();
    const k = String(key || "").trim();
    if (!k) return NextResponse.json({ error: "key required" }, { status: 400 });

    await prisma.shoppingListItem.update({
      where: { householdId_key: { householdId, key: k } },
      data: { checked: !!checked },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
}
