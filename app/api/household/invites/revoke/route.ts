import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership, isOwner } from "@/lib/server/me";

export async function POST(req: Request) {
  const data = await requireMembership();
  if (!data?.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!data.membership) return NextResponse.json({ error: "NO_HOUSEHOLD" }, { status: 400 });
  if (!isOwner(data.membership.role)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const inviteId = String(body?.inviteId ?? "").trim();
  if (!inviteId) return NextResponse.json({ error: "INVITE_ID_REQUIRED" }, { status: 400 });

  const inv = await prisma.householdInvite.findUnique({
    where: { id: inviteId },
    select: { id: true, householdId: true, status: true },
  });

  if (!inv || inv.householdId !== data.membership.householdId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  await prisma.householdInvite.update({
    where: { id: inviteId },
    data: { status: "REVOKED" },
  });

  return NextResponse.json({ ok: true });
}
