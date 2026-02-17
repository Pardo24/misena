import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, getActiveHouseholdId } from "@/lib/server/household";

export const dynamic = "force-dynamic";

type ItemIn = {
  nameKey: string;
  qty?: number | null;
  unit?: string | null;
};

export async function POST(req: Request) {
  try {
    const { userId } = await requireUser();
    const householdId = await getActiveHouseholdId(userId);

    const body = await req.json().catch(() => ({}));
    const items: ItemIn[] = Array.isArray(body?.items) ? body.items : [];

    if (!items.length)
      return NextResponse.json({ error: "items required" }, { status: 400 });

    const deducted: Array<{ nameKey: string; oldQty: number | null; newQty: number | null; unit: string | null }> = [];

    await prisma.$transaction(async (tx) => {
      for (const it of items) {
        const nameKey = String(it?.nameKey ?? "").trim().toLowerCase();
        if (!nameKey) continue;

        const existing = await tx.pantryItem.findFirst({
          where: { householdId, nameKey },
          select: { id: true, qty: true, unit: true },
        });

        if (!existing) {
          deducted.push({ nameKey, oldQty: null, newQty: null, unit: null });
          continue;
        }

        const deductQty = it.qty != null ? Number(it.qty) : null;

        if (existing.qty != null && deductQty != null) {
          const newQty = Math.max(0, existing.qty - deductQty);
          await tx.pantryItem.update({
            where: { id: existing.id },
            data: { qty: newQty },
          });
          deducted.push({ nameKey, oldQty: existing.qty, newQty, unit: existing.unit });
        } else if (deductQty != null && existing.qty == null) {
          // pantry has no qty tracked — can't deduct, just report
          deducted.push({ nameKey, oldQty: null, newQty: null, unit: existing.unit });
        } else if (deductQty == null && existing.qty != null) {
          // recipe has no numeric qty — set pantry to 0 (consumed)
          await tx.pantryItem.update({
            where: { id: existing.id },
            data: { qty: 0 },
          });
          deducted.push({ nameKey, oldQty: existing.qty, newQty: 0, unit: existing.unit });
        } else {
          // both null — nothing to deduct
          deducted.push({ nameKey, oldQty: null, newQty: null, unit: existing.unit });
        }
      }
    });

    return NextResponse.json({ ok: true, deducted });
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
}
