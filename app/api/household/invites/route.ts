import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership, isOwner } from "@/lib/server/me";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await requireMembership();
  if (!data?.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const membership = data.membership;
  if (!membership) {
    return NextResponse.json({ household: null, members: [], invites: [] });
  }

  const household = await prisma.household.findUnique({
    where: { id: membership.householdId },
    select: { id: true, name: true, createdAt: true },
  });

  const members = await prisma.householdMember.findMany({
    where: { householdId: membership.householdId },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      createdAt: true,
      user: { select: { id: true, email: true, name: true, image: true } },
    },
  });

  // auto-expire pending invites that passed their expiresAt
  await prisma.householdInvite.updateMany({
    where: {
      householdId: membership.householdId,
      status: "PENDING",
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  });

  const invites = await prisma.householdInvite.findMany({
    where: { householdId: membership.householdId, status: { in: ["PENDING", "ACCEPTED"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, status: true, createdAt: true, expiresAt: true, acceptedAt: true },
  });

  return NextResponse.json({
    household,
    role: membership.role,
    members: members.map(m => ({ ...m.user, role: m.role, joinedAt: m.createdAt })),
    invites,
  });
}

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
function getBaseUrl(req: Request) {
  const h = req.headers;

  const xfProto = h.get("x-forwarded-proto");
  const xfHost = h.get("x-forwarded-host");
  const host = xfHost ?? h.get("host");

  // 1) proto real si viene de proxy, si no:
  //    - production => https
  //    - dev => http (salvo que tú uses https en local)
  const proto =
    xfProto ??
    (process.env.NODE_ENV === "production" ? "https" : "http");

  if (host) return `${proto}://${host}`.replace(/\/$/, "");

  // 2) fallback: preferir un APP_URL propio antes que NEXTAUTH_URL
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";

  return envUrl.replace(/\/$/, "");
}


export async function POST(req: Request) {
  const data = await requireMembership();
  if (!data?.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!data.membership) return NextResponse.json({ error: "NO_HOUSEHOLD" }, { status: 400 });
  if (!isOwner(data.membership.role)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  // email is now optional — empty means "shareable link for anyone"

  const token = crypto.randomBytes(24).toString("hex");
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 48); // 48h expiry

  const invite = await prisma.householdInvite.create({
    data: {
      householdId: data.membership.householdId,
      email: email || "", // empty = shareable link
      tokenHash,
      expiresAt,
      invitedByUserId: data.user.id,
    },
    select: { id: true, email: true, createdAt: true, expiresAt: true },
  });

  const baseUrl = getBaseUrl(req);
  const acceptUrl = `${baseUrl}/invite?token=${encodeURIComponent(token)}`;

  return NextResponse.json({ ok: true,inviteId:invite.id, invite, acceptUrl });
}