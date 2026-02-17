import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, name: true, image: true },
  });

  return user ?? null;
}

export async function getMyMembership(userId: string) {
  const membership = await prisma.householdMember.findFirst({
    where: { userId },
    select: { householdId: true, role: true },
    orderBy: { createdAt: "asc" },
  });
  return membership ?? null;
}

export async function requireMembership() {
  const user = await requireUser();
  if (!user) return null;

  const membership = await getMyMembership(user.id);
  return { user, membership }; // membership puede ser null si no tiene household
}

export function isOwner(role?: string) {
  return role === "OWNER";
}
