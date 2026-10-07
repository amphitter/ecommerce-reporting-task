import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getFilterOptions } from "@/lib/db/repository";

export async function GET(request: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const options = await getFilterOptions();
    return NextResponse.json(options);
  } catch (error) {
    console.error("Filter options error:", error);
    return NextResponse.json({ error: "Failed to load filter options" }, { status: 500 });
  }
}
