import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server/household";

export const dynamic = "force-dynamic";

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function POST(req: Request) {
  try {
    const { userId, session } = await requireUser();
    const { token } = await req.json();
    const tokenStr = String(token || "");
    if (!tokenStr) return NextResponse.json({ error: "token required" }, { status: 400 });

    const tokenHash = sha256(tokenStr);

    const invite = await prisma.householdInvite.findUnique({
      where: { tokenHash },
    });

    if (!invite) return NextResponse.json({ error: "invalid token" }, { status: 400 });
    if (invite.status !== "PENDING") return NextResponse.json({ error: "not pending" }, { status: 400 });
    if (invite.expiresAt.getTime() < Date.now()) return NextResponse.json({ error: "expired" }, { status: 400 });

    // Asegura que el email coincide con el usuario logueado
    const userEmail = (session.user?.email || "").toLowerCase();
    if (!userEmail || userEmail !== invite.email) {
      return NextResponse.json({ error: "email mismatch" }, { status: 403 });
    }

    await prisma.$transaction([
      prisma.householdMember.upsert({
        where: { householdId_userId: { householdId: invite.householdId, userId } },
        update: {},
        create: { householdId: invite.householdId, userId, role: "MEMBER" },
      }),
      prisma.householdInvite.update({
        where: { tokenHash },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
}
