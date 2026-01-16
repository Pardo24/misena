import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, getActiveHouseholdId } from "@/lib/server/household";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await requireUser();
    const householdId = await getActiveHouseholdId(userId);

    const household = await prisma.household.findUnique({
      where: { id: householdId },
      include: {
        members: { include: { user: { select: { id: true, email: true, name: true } } } },
        invites: { orderBy: { createdAt: "desc" } },
      },
    });

    return NextResponse.json(household);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
}
