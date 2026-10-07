import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { importCsv, ImportType } from "@/lib/db/import";
import { getDatabaseCounts } from "@/lib/db/repository";
import { getDbClient } from "@/lib/db/engine";

export async function GET(request: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const counts = await getDatabaseCounts();
    return NextResponse.json({ counts });
  } catch (error) {
    console.error("Get counts error:", error);
    return NextResponse.json({ error: "Failed to get database counts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as ImportType | null;

    if (!file || !type) {
      return NextResponse.json({ error: "File and type required" }, { status: 400 });
    }

    if (!["products", "orders", "inventory"].includes(type)) {
      return NextResponse.json({ error: "Invalid import type" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json({ error: "Only CSV files are supported" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importCsv(buffer, type);
    const counts = await getDatabaseCounts();

    if (!result.success) {
      return NextResponse.json({ ...result, counts }, { status: 400 });
    }

    return NextResponse.json({ ...result, counts });
  } catch (error) {
    console.error("Import API error:", error);
    return NextResponse.json({
      error: "Import failed",
      success: false,
      imported: 0,
      invalid: 0,
      errors: [String(error)],
      message: "Server error during import",
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const db = await getDbClient();
    await db.execute("DELETE FROM orders");
    await db.execute("DELETE FROM products");
    await db.execute("DELETE FROM inventory");
    await db.execute("DELETE FROM warehouses");

    return NextResponse.json({ success: true, message: "Database cleared successfully" });
  } catch (error) {
    console.error("Clear database error:", error);
    return NextResponse.json({ error: "Failed to clear database" }, { status: 500 });
  }
}
