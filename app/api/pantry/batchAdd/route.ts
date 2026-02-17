import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, getActiveHouseholdId } from "@/lib/server/household";

export const dynamic = "force-dynamic";

type ItemIn = {
  nameKey: string;
  qty?: number | null;
  unit?: string | null;
  alwaysHave?: boolean;
};

function normUnit(u: any) {
  const s = String(u ?? "").trim().toLowerCase();
  return s ? s : null;
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireUser();
    const householdId = await getActiveHouseholdId(userId);

    const body = await req.json().catch(() => ({}));
    const items: ItemIn[] = Array.isArray(body?.items) ? body.items : [];

    if (!items.length) return NextResponse.json({ error: "items required" }, { status: 400 });

    // normaliza + agrupa por nameKey+unit para sumar
    const grouped = new Map<string, { nameKey: string; unit: string | null; qty: number | null; alwaysHave?: boolean }>();

    for (const it of items) {
      const nameKey = String(it?.nameKey ?? "").trim().toLowerCase();
      if (!nameKey) continue;

      const unit = normUnit(it.unit);
      const qtyNum =
        it.qty == null || Number.isNaN(Number(it.qty)) ? null : Number(it.qty);

      const k = `${nameKey}__${unit ?? ""}`;
      const prev = grouped.get(k);

      if (!prev) {
        grouped.set(k, { nameKey, unit, qty: qtyNum, alwaysHave: it.alwaysHave });
      } else {
        // suma si hay qty
        if (prev.qty != null && qtyNum != null) prev.qty += qtyNum;
        else if (prev.qty == null) prev.qty = qtyNum; // si antes era null, usa el nuevo si viene
        // alwaysHave: si alguien lo marca true, true
        if (it.alwaysHave === true) prev.alwaysHave = true;
      }
    }

    const rows = Array.from(grouped.values());
    if (!rows.length) return NextResponse.json({ ok: true, changed: 0 });

    // upsert + suma contra qty existente si coincide unidad
    await prisma.$transaction(async (tx) => {
      for (const r of rows) {
        const existing = await tx.pantryItem.findFirst({
          where: { householdId, nameKey: r.nameKey },
          select: { id: true, qty: true, unit: true, alwaysHave: true },
        });

        if (!existing) {
          await tx.pantryItem.create({
            data: {
              householdId,
              nameKey: r.nameKey,
              qty: r.qty ?? null,
              unit: r.unit ?? null,
              alwaysHave: r.alwaysHave ?? false,
            },
          });
          continue;
        }

        // si la unidad coincide, suma qty. Si no coincide, NO sumamos (mantén lo que hay)
        const sameUnit =
          (existing.unit ?? null) === (r.unit ?? null) || existing.unit == null || r.unit == null;

        const nextQty =
          sameUnit && existing.qty != null && r.qty != null ? existing.qty + r.qty : existing.qty ?? r.qty ?? null;

        await tx.pantryItem.update({
          where: { id: existing.id },
          data: {
            qty: nextQty,
            unit: existing.unit ?? r.unit ?? null,
            alwaysHave: r.alwaysHave === true ? true : existing.alwaysHave,
          },
        });
      }
    });

    return NextResponse.json({ ok: true, changed: rows.length });
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
}
