import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUser, getActiveHouseholdId } from "@/lib/server/household";

export const dynamic = "force-dynamic";

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireUser();
    const householdId = await getActiveHouseholdId(userId);

    const { email } = await req.json();
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized) return NextResponse.json({ error: "email required" }, { status: 400 });

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256(token);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.householdInvite.create({
      data: {
        householdId,
        email: normalized,
        tokenHash,
        expiresAt,
        invitedByUserId: userId,
      },
    });

    // TODO: enviar email con link:
    // `${process.env.NEXTAUTH_URL}/invite/accept?token=${token}`
    // Aquí no lo envío porque depende de tu SMTP/config.

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
}
