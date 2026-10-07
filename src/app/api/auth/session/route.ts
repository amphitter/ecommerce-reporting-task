import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";

export async function GET() {
  const authed = await verifySession();
  return NextResponse.json({ authenticated: authed });
}
