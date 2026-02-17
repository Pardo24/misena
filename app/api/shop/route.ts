import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, getActiveHouseholdId } from "@/lib/server/household";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await requireUser();
    const householdId = await getActiveHouseholdId(userId);

    const items = await prisma.shoppingListItem.findMany({
      where: { householdId },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(items);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
}

export async function PUT(req: Request) {
  try {
    const { userId } = await requireUser();
    const householdId = await getActiveHouseholdId(userId);

    const { items } = await req.json();
    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "items[] required" }, { status: 400 });
    }

    // upsert por key + borrar los que ya no estén
    const keys = items.map((x: any) => String(x.key || "").trim()).filter(Boolean);

    await prisma.$transaction(async (tx) => {
      // borra los que ya no están
      await tx.shoppingListItem.deleteMany({
        where: { householdId, key: { notIn: keys.length ? keys : ["__none__"] } },
      });

      // upserts
      for (const it of items) {
        const key = String(it.key || "").trim();
        if (!key) continue;

        await tx.shoppingListItem.upsert({
          where: { householdId_key: { householdId, key } },
          update: {
            name: String(it.name ?? ""),
            qty: it.qty ?? null,
            unit: it.unit ?? null,
            qtyText: it.qtyText ?? null,
            category: it.category ?? null,
            checked: !!it.checked,
          },
          create: {
            householdId,
            key,
            name: String(it.name ?? ""),
            qty: it.qty ?? null,
            unit: it.unit ?? null,
            qtyText: it.qtyText ?? null,
            category: it.category ?? null,
            checked: !!it.checked,
          },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
}
