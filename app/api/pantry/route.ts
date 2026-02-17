import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, getActiveHouseholdId } from "@/lib/server/household";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await requireUser();
    const householdId = await getActiveHouseholdId(userId);

    const items = await prisma.pantryItem.findMany({
      where: { householdId },
      orderBy: { nameKey: "asc" },
    });

    return NextResponse.json(items);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireUser();
    const householdId = await getActiveHouseholdId(userId);

    const body = await req.json().catch(() => ({}));
    const nameKey = String(body?.nameKey ?? "").trim().toLowerCase();
    if (!nameKey) return NextResponse.json({ error: "nameKey required" }, { status: 400 });

    const alwaysHave = body?.alwaysHave != null ? !!body.alwaysHave : undefined;

    const qtyRaw = body?.qty;
    const qty =
      qtyRaw === "" || qtyRaw == null || Number.isNaN(Number(qtyRaw)) ? null : Number(qtyRaw);

    const unitRaw = body?.unit;
    const unit = unitRaw == null ? null : String(unitRaw).trim().toLowerCase() || null;

    await prisma.pantryItem.upsert({
      where: { householdId_nameKey: { householdId, nameKey } },
      update: {
        ...(alwaysHave !== undefined ? { alwaysHave } : {}),
        qty,
        unit,
      },
      create: {
        householdId,
        nameKey,
        alwaysHave: alwaysHave ?? false,
        qty,
        unit,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = await requireUser();
    const householdId = await getActiveHouseholdId(userId);

    const { searchParams } = new URL(req.url);
    const nameKey = String(searchParams.get("nameKey") || "").trim().toLowerCase();
    if (!nameKey) return NextResponse.json({ error: "nameKey required" }, { status: 400 });

    await prisma.pantryItem.deleteMany({ where: { householdId, nameKey } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
}