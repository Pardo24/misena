import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  return NextResponse.json({
    loggedIn: !!session?.user,
    user: session?.user ?? null,
  });
}
