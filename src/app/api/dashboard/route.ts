import { NextRequest, NextResponse } from "next/server";
import { dashboardQuerySchema } from "@/lib/validation/schemas";
import { requireAuth } from "@/lib/auth/session";
import { getDashboardMetrics } from "@/lib/db/repository";

export async function GET(request: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const filters = dashboardQuerySchema.parse(searchParams);

    const data = await getDashboardMetrics(filters);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: "Invalid request or error calculating metrics" }, { status: 400 });
  }
}
