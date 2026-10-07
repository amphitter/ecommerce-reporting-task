import { NextRequest, NextResponse } from "next/server";
import { productsQuerySchema } from "@/lib/validation/schemas";
import { requireAuth } from "@/lib/auth/session";
import { getDbClient } from "@/lib/db/engine";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const filters = productsQuerySchema.parse(searchParams);

    const conditions: string[] = ["1=1"];
    const params: any[] = [];

    if (filters.category) { conditions.push("p.category = ?"); params.push(filters.category); }
    if (filters.sku) { conditions.push("p.sku LIKE ?"); params.push(`%${filters.sku}%`); }
    if (filters.search) {
      conditions.push("(p.sku LIKE ? OR p.product_name LIKE ?)");
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    const whereClause = conditions.join(" AND ");
    const db = await getDbClient();

    const rs = await db.execute({
      sql: `
        SELECT
          p.sku,
          p.product_name,
          p.category,
          COALESCE(ord.sold_quantity, 0) as sold_quantity,
          COALESCE(ord.sales_amount, 0) as sales_amount,
          COALESCE(ord.returned_quantity, 0) as returned_quantity,
          COALESCE(ord.return_amount, 0) as return_amount,
          COALESCE(inv.total_stock, 0) as total_stock,
          COALESCE(inv.warehouse_count, 0) as warehouse_count,
          COALESCE(ord.top_marketplace, '-') as top_marketplace
        FROM products p
        LEFT JOIN (
          SELECT
            sku,
            SUM(available_quantity) as total_stock,
            COUNT(DISTINCT warehouse) as warehouse_count
          FROM inventory
          GROUP BY sku
        ) inv ON inv.sku = p.sku
        LEFT JOIN (
          SELECT
            sku,
            SUM(CASE WHEN order_status NOT IN ('Cancelled', 'Returned') THEN quantity ELSE 0 END) as sold_quantity,
            SUM(CASE WHEN order_status NOT IN ('Cancelled', 'Returned') THEN order_amount ELSE 0 END) as sales_amount,
            SUM(CASE WHEN order_status = 'Returned' THEN quantity ELSE 0 END) as returned_quantity,
            SUM(CASE WHEN order_status = 'Returned' THEN order_amount ELSE 0 END) as return_amount,
            (
              SELECT marketplace
              FROM orders o2
              WHERE o2.sku = o1.sku AND o2.order_status NOT IN ('Cancelled', 'Returned')
              GROUP BY marketplace
              ORDER BY SUM(order_amount) DESC
              LIMIT 1
            ) as top_marketplace
          FROM orders o1
          GROUP BY sku
        ) ord ON ord.sku = p.sku
        WHERE ${whereClause}
        ORDER BY p.sku ASC
        LIMIT 20000
      `,
      args: params,
    });

    const headers = [
      "sku", "product_name", "category", "sold_quantity",
      "sales_amount", "returned_quantity", "return_amount",
      "total_stock", "warehouse_count", "top_marketplace"
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
        "Content-Disposition": `attachment; filename="products_report_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Products export error:", error);
    return NextResponse.json({ error: "Failed to generate products CSV" }, { status: 500 });
  }
}
