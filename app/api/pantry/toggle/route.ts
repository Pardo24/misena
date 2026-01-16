import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getActiveHouseholdId } from "@/lib/server/household";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const householdId = await getActiveHouseholdId(userId);

  const { nameKey, alwaysHave } = await req.json();
  const key = String(nameKey || "").trim().toLowerCase();
  if (!key) return NextResponse.json({ error: "nameKey required" }, { status: 400 });

  await prisma.pantryItem.update({
    where: { householdId_nameKey: { householdId, nameKey: key } },
    data: { alwaysHave: !!alwaysHave },
  });

  return NextResponse.json({ ok: true });
}
