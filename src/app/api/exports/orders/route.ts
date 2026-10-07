import { NextRequest, NextResponse } from "next/server";
import { ordersQuerySchema } from "@/lib/validation/schemas";
import { requireAuth } from "@/lib/auth/session";
import { getDbClient } from "@/lib/db/engine";

export async function GET(request: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const filters = ordersQuerySchema.parse(searchParams);

    const conditions: string[] = ["1=1"];
    const params: any[] = [];

    if (filters.from) { conditions.push("o.order_date >= ?"); params.push(filters.from); }
    if (filters.to) { conditions.push("o.order_date <= ?"); params.push(filters.to); }
    if (filters.marketplace) { conditions.push("o.marketplace = ?"); params.push(filters.marketplace); }
    if (filters.warehouse) { conditions.push("o.final_warehouse = ?"); params.push(filters.warehouse); }
    if (filters.category) { conditions.push("o.category = ?"); params.push(filters.category); }
    if (filters.status) { conditions.push("o.order_status = ?"); params.push(filters.status); }
    if (filters.sku) { conditions.push("o.sku LIKE ?"); params.push(`%${filters.sku}%`); }
    if (filters.search) {
      conditions.push("(o.order_id LIKE ? OR o.sku LIKE ? OR p.product_name LIKE ?)");
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }

    const whereClause = conditions.join(" AND ");
    const db = await getDbClient();

    const rs = await db.execute({
      sql: `
        SELECT
          o.order_id,
          o.order_date,
          o.marketplace,
          o.sku,
          COALESCE(p.product_name, 'Unknown Product') as product_name,
          o.category,
          o.quantity,
          o.selling_price,
          o.order_amount,
          o.order_status,
          o.final_warehouse,
          COALESCE(inv.total_stock, 0) as available_stock
        FROM orders o
        LEFT JOIN products p ON p.sku = o.sku
        LEFT JOIN (
          SELECT sku, SUM(available_quantity) as total_stock
          FROM inventory
          GROUP BY sku
        ) inv ON inv.sku = o.sku
        WHERE ${whereClause}
        ORDER BY o.order_date DESC, o.order_id DESC
        LIMIT 20000
      `,
      args: params,
    });

    const headers = [
      "order_id", "order_date", "marketplace", "sku", "product_name",
      "category", "quantity", "selling_price", "order_amount",
      "order_status", "final_warehouse", "available_stock"
    ];

    const csvRows = [headers.join(",")];
    for (const row of rs.rows) {
      const line = headers.map(h => {
        const val = String(row[h] ?? "").replace(/"/g, '""');
        return `"${val}"`;
      }).join(",");
      csvRows.push(line);
    }

    const csv = csvRows.join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="orders_report_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Orders export error:", error);
    return NextResponse.json({ error: "Failed to generate orders CSV" }, { status: 500 });
  }
}
