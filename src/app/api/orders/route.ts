import { NextRequest, NextResponse } from "next/server";
import { ordersQuerySchema } from "@/lib/validation/schemas";
import { requireAuth } from "@/lib/auth/session";
import { getOrders } from "@/lib/db/repository";

export async function GET(request: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const filters = ordersQuerySchema.parse(searchParams);

    const result = await getOrders(filters);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Orders API error:", error);
    return NextResponse.json({ error: "Failed to load orders" }, { status: 500 });
  }
}
