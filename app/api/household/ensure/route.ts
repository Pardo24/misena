import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/server/me";

export async function POST() {
  const data = await requireMembership();
  if (!data?.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  if (data.membership) {
    return NextResponse.json({ ok: true, householdId: data.membership.householdId, role: data.membership.role });
  }

  const created = await prisma.$transaction(async (tx) => {
    const h = await tx.household.create({
      data: { name: `${data.user.name ?? "Mi"} household` },
      select: { id: true },
    });

    await tx.householdMember.create({
      data: { householdId: h.id, userId: data.user.id, role: "OWNER" },
    });

    return h;
  });

  return NextResponse.json({ ok: true, householdId: created.id, role: "OWNER" });
}
