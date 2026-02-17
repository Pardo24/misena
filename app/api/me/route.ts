import { NextResponse } from "next/server";
import { requireMembership } from "@/lib/server/me";

export async function GET() {
  const data = await requireMembership();
  if (!data?.user) return NextResponse.json({ loggedIn: false });

  return NextResponse.json({
    loggedIn: true,
    user: data.user,
    householdId: data.membership?.householdId ?? null,
    role: data.membership?.role ?? null,
  });
}
