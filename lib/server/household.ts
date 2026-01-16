import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) throw new Error("UNAUTHORIZED");
  return { userId, session };
}

// Devuelve el household “activo” del usuario.
// (Para simplificar: el primero. Luego puedes guardar defaultHouseholdId en User.)
export async function getActiveHouseholdId(userId: string) {
  const m = await prisma.householdMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { householdId: true },
  });
  if (m) return m.householdId;

  // Si por lo que sea no tiene, creamos uno
  const created = await prisma.household.create({
    data: {
      members: {
        create: { userId, role: "OWNER" },
      },
    },
    select: { id: true },
  });
  return created.id;
}
