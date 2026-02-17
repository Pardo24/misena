import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) throw new Error("UNAUTHORIZED");
  return { userId, session };
}

// lib/server/household.ts
export async function getActiveHouseholdId(userId: string) {
  const memberships = await prisma.householdMember.findMany({
    where: { userId },
    select: { householdId: true },
  });
  if (!memberships.length) throw new Error("NO_HOUSEHOLD");

  // Coge el household con más miembros
  const householdIds = memberships.map(m => m.householdId);

  const counts = await prisma.householdMember.groupBy({
    by: ["householdId"],
    where: { householdId: { in: householdIds } },
    _count: { userId: true },
  });

  counts.sort((a, b) => (b._count.userId ?? 0) - (a._count.userId ?? 0));
  return counts[0].householdId;
}
