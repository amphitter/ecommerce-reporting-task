import { NextRequest, NextResponse } from "next/server";
import { productsQuerySchema } from "@/lib/validation/schemas";
import { requireAuth } from "@/lib/auth/session";
import { getProducts } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const filters = productsQuerySchema.parse(searchParams);

    const result = await getProducts(filters);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Products API error:", error);
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }
}
