import { NextRequest, NextResponse } from "next/server";
import { inventoryQuerySchema } from "@/lib/validation/schemas";
import { requireAuth } from "@/lib/auth/session";
import { getInventory } from "@/lib/db/repository";

export async function GET(request: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const filters = inventoryQuerySchema.parse(searchParams);

    const result = await getInventory(filters);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Inventory API error:", error);
    return NextResponse.json({ error: "Failed to load inventory" }, { status: 500 });
  }
}
