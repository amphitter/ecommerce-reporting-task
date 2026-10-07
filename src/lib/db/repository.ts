import { getDbClient } from "./engine";
import { getSupabase, isSupabaseConfigured } from "../supabase/server";
import { DashboardFilters, OrdersFilters, ProductsFilters, InventoryFilters } from "../validation/schemas";

export interface DashboardResponse {
  kpis: {
    totalSales: number;
    totalReturnAmount: number;
    totalUnitsSold: number;
    totalUnitsReturned: number;
    highestReturnProductByAmount: { sku: string; product_name: string; return_amount: number } | null;
    highestReturnProductByQuantity: { sku: string; product_name: string; return_units: number } | null;
    lowestStockProduct: { sku: string; product_name: string; total_stock: number } | null;
    highestStockProduct: { sku: string; product_name: string; total_stock: number } | null;
    averageConsumptionPerDay: number;
    highestSellingProduct: { sku: string; product_name: string; sales_amount: number; units_sold: number } | null;
    returnRate: number;
    averageOrderValue: number;
  };
  warehouseSales: Array<{ warehouse: string; sales: number; units: number; percentage: number }>;
  salesTrend: Array<{ date: string; sales: number; returns: number; units: number }>;
  topProducts: Array<{
    sku: string;
    product_name: string;
    category: string;
    sales: number;
    units: number;
    returns: number;
  }>;
}

export async function getDashboardMetrics(filters: DashboardFilters): Promise<DashboardResponse> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabase()!;
    const { data, error } = await supabase.rpc("get_dashboard_metrics", {
      p_from: filters.from || null,
      p_to: filters.to || null,
      p_marketplace: filters.marketplace || null,
      p_warehouse: filters.warehouse || null,
      p_sku: filters.sku || null,
      p_category: filters.category || null,
      p_status: filters.status || null,
    });

    if (!error && data) {
      return data as DashboardResponse;
    }
  }

  // Local / Fallback SQL Execution
  const db = await getDbClient();

  const countRs = await db.execute("SELECT COUNT(*) as count FROM orders");
  const hasOrders = Number(countRs.rows[0].count) > 0;

  if (!hasOrders) {
    return {
      kpis: {
        totalSales: 0,
        totalReturnAmount: 0,
        totalUnitsSold: 0,
        totalUnitsReturned: 0,
        highestReturnProductByAmount: null,
        highestReturnProductByQuantity: null,
        lowestStockProduct: null,
        highestStockProduct: null,
        averageConsumptionPerDay: 0,
        highestSellingProduct: null,
        returnRate: 0,
        averageOrderValue: 0,
      },
      warehouseSales: [],
      salesTrend: [],
      topProducts: [],
    };
  }

  const conditions: string[] = ["1=1"];
  const params: any[] = [];

  if (filters.from) { conditions.push("o.order_date >= ?"); params.push(filters.from); }
  if (filters.to) { conditions.push("o.order_date <= ?"); params.push(filters.to); }
  if (filters.marketplace) { conditions.push("o.marketplace = ?"); params.push(filters.marketplace); }
  if (filters.warehouse) { conditions.push("o.final_warehouse = ?"); params.push(filters.warehouse); }
  if (filters.category) { conditions.push("o.category = ?"); params.push(filters.category); }
  if (filters.status) { conditions.push("o.order_status = ?"); params.push(filters.status); }
  if (filters.sku) { conditions.push("o.sku LIKE ?"); params.push(`%${filters.sku}%`); }

  const whereClause = conditions.join(" AND ");

  let minDate = filters.from;
  let maxDate = filters.to;

  if (!minDate || !maxDate) {
    const dateRangeRs = await db.execute({
      sql: `SELECT MIN(o.order_date) as min_d, MAX(o.order_date) as max_d FROM orders o WHERE ${whereClause}`,
      args: params,
    });
    const row = dateRangeRs.rows[0];
    minDate = (row.min_d as string) || "2026-01-01";
    maxDate = (row.max_d as string) || "2026-01-01";
  }

  const days = Math.max(
    1,
    Math.round((new Date(maxDate).getTime() - new Date(minDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
  );

  const kpiRs = await db.execute({
    sql: `
      SELECT
        COALESCE(SUM(CASE WHEN o.order_status NOT IN ('Cancelled', 'Returned') THEN o.order_amount ELSE 0 END), 0) AS total_sales,
        COALESCE(SUM(CASE WHEN o.order_status = 'Returned' THEN o.order_amount ELSE 0 END), 0) AS total_return_amount,
        COALESCE(SUM(CASE WHEN o.order_status NOT IN ('Cancelled', 'Returned') THEN o.quantity ELSE 0 END), 0) AS total_units_sold,
        COALESCE(SUM(CASE WHEN o.order_status = 'Returned' THEN o.quantity ELSE 0 END), 0) AS total_units_returned,
        COUNT(DISTINCT CASE WHEN o.order_status NOT IN ('Cancelled', 'Returned') THEN o.order_id END) AS valid_orders
      FROM orders o
      WHERE ${whereClause}
    `,
    args: params,
  });

  const kpiRow = kpiRs.rows[0];
  const totalSales = Number(kpiRow.total_sales || 0);
  const totalReturnAmount = Number(kpiRow.total_return_amount || 0);
  const totalUnitsSold = Number(kpiRow.total_units_sold || 0);
  const totalUnitsReturned = Number(kpiRow.total_units_returned || 0);
  const validOrders = Number(kpiRow.valid_orders || 0);

  const returnRate = totalUnitsSold > 0 ? Number((totalUnitsReturned / totalUnitsSold).toFixed(4)) : 0;
  const averageOrderValue = validOrders > 0 ? Number((totalSales / validOrders).toFixed(2)) : 0;
  const averageConsumptionPerDay = days > 0 ? Number((totalUnitsSold / days).toFixed(2)) : 0;

  const topSellingRs = await db.execute({
    sql: `
      SELECT o.sku, p.product_name,
             SUM(o.order_amount) as sales_amount,
             SUM(o.quantity) as units_sold
      FROM orders o
      LEFT JOIN products p ON p.sku = o.sku
      WHERE ${whereClause} AND o.order_status NOT IN ('Cancelled', 'Returned')
      GROUP BY o.sku, p.product_name
      ORDER BY sales_amount DESC
      LIMIT 1
    `,
    args: params,
  });
  const highestSellingProduct = topSellingRs.rows.length > 0
    ? {
        sku: String(topSellingRs.rows[0].sku),
        product_name: String(topSellingRs.rows[0].product_name || "Unknown Product"),
        sales_amount: Number(topSellingRs.rows[0].sales_amount),
        units_sold: Number(topSellingRs.rows[0].units_sold),
      }
    : null;

  const topReturnAmountRs = await db.execute({
    sql: `
      SELECT o.sku, p.product_name,
             SUM(o.order_amount) as return_amount
      FROM orders o
      LEFT JOIN products p ON p.sku = o.sku
      WHERE ${whereClause} AND o.order_status = 'Returned'
      GROUP BY o.sku, p.product_name
      ORDER BY return_amount DESC
      LIMIT 1
    `,
    args: params,
  });
  const highestReturnProductByAmount = topReturnAmountRs.rows.length > 0
    ? {
        sku: String(topReturnAmountRs.rows[0].sku),
        product_name: String(topReturnAmountRs.rows[0].product_name || "Unknown Product"),
        return_amount: Number(topReturnAmountRs.rows[0].return_amount),
      }
    : null;

  const topReturnQtyRs = await db.execute({
    sql: `
      SELECT o.sku, p.product_name,
             SUM(o.quantity) as return_units
      FROM orders o
      LEFT JOIN products p ON p.sku = o.sku
      WHERE ${whereClause} AND o.order_status = 'Returned'
      GROUP BY o.sku, p.product_name
      ORDER BY return_units DESC
      LIMIT 1
    `,
    args: params,
  });
  const highestReturnProductByQuantity = topReturnQtyRs.rows.length > 0
    ? {
        sku: String(topReturnQtyRs.rows[0].sku),
        product_name: String(topReturnQtyRs.rows[0].product_name || "Unknown Product"),
        return_units: Number(topReturnQtyRs.rows[0].return_units),
      }
    : null;

  const lowestStockRs = await db.execute(`
    SELECT i.sku, p.product_name, SUM(i.available_quantity) as total_stock
    FROM inventory i
    LEFT JOIN products p ON p.sku = i.sku
    GROUP BY i.sku, p.product_name
    ORDER BY total_stock ASC
    LIMIT 1
  `);
  const lowestStockProduct = lowestStockRs.rows.length > 0
    ? {
        sku: String(lowestStockRs.rows[0].sku),
        product_name: String(lowestStockRs.rows[0].product_name || "Unknown Product"),
        total_stock: Number(lowestStockRs.rows[0].total_stock),
      }
    : null;

  const highestStockRs = await db.execute(`
    SELECT i.sku, p.product_name, SUM(i.available_quantity) as total_stock
    FROM inventory i
    LEFT JOIN products p ON p.sku = i.sku
    GROUP BY i.sku, p.product_name
    ORDER BY total_stock DESC
    LIMIT 1
  `);
  const highestStockProduct = highestStockRs.rows.length > 0
    ? {
        sku: String(highestStockRs.rows[0].sku),
        product_name: String(highestStockRs.rows[0].product_name || "Unknown Product"),
        total_stock: Number(highestStockRs.rows[0].total_stock),
      }
    : null;

  const warehouseRs = await db.execute({
    sql: `
      SELECT o.final_warehouse,
             SUM(o.order_amount) as sales,
             SUM(o.quantity) as units
      FROM orders o
      WHERE ${whereClause} AND o.order_status NOT IN ('Cancelled', 'Returned')
      GROUP BY o.final_warehouse
      ORDER BY sales DESC
    `,
    args: params,
  });

  const warehouseSales = warehouseRs.rows.map((row: any) => {
    const s = Number(row.sales || 0);
    return {
      warehouse: String(row.final_warehouse),
      sales: s,
      units: Number(row.units || 0),
      percentage: totalSales > 0 ? Number(((s / totalSales) * 100).toFixed(1)) : 0,
    };
  });

  const trendRs = await db.execute({
    sql: `
      SELECT o.order_date,
             SUM(CASE WHEN o.order_status NOT IN ('Cancelled', 'Returned') THEN o.order_amount ELSE 0 END) as sales,
             SUM(CASE WHEN o.order_status = 'Returned' THEN o.order_amount ELSE 0 END) as returns,
             SUM(CASE WHEN o.order_status NOT IN ('Cancelled', 'Returned') THEN o.quantity ELSE 0 END) as units
      FROM orders o
      WHERE ${whereClause}
      GROUP BY o.order_date
      ORDER BY o.order_date ASC
    `,
    args: params,
  });

  const salesTrend = trendRs.rows.map((row: any) => ({
    date: String(row.order_date),
    sales: Number(row.sales || 0),
    returns: Number(row.returns || 0),
    units: Number(row.units || 0),
  }));

  const topProductsRs = await db.execute({
    sql: `
      SELECT o.sku, p.product_name, o.category,
             SUM(o.order_amount) as sales,
             SUM(o.quantity) as units,
             SUM(CASE WHEN o.order_status = 'Returned' THEN o.order_amount ELSE 0 END) as returns
      FROM orders o
      LEFT JOIN products p ON p.sku = o.sku
      WHERE ${whereClause} AND o.order_status NOT IN ('Cancelled', 'Returned')
      GROUP BY o.sku, p.product_name, o.category
      ORDER BY sales DESC
      LIMIT 5
    `,
    args: params,
  });

  const topProducts = topProductsRs.rows.map((row: any) => ({
    sku: String(row.sku),
    product_name: String(row.product_name || "Unknown Product"),
    category: String(row.category || "General"),
    sales: Number(row.sales || 0),
    units: Number(row.units || 0),
    returns: Number(row.returns || 0),
  }));

  return {
    kpis: {
      totalSales: Number(totalSales.toFixed(2)),
      totalReturnAmount: Number(totalReturnAmount.toFixed(2)),
      totalUnitsSold,
      totalUnitsReturned,
      highestReturnProductByAmount,
      highestReturnProductByQuantity,
      lowestStockProduct,
      highestStockProduct,
      averageConsumptionPerDay,
      highestSellingProduct,
      returnRate,
      averageOrderValue,
    },
    warehouseSales,
    salesTrend,
    topProducts,
  };
}

export async function getOrders(filters: OrdersFilters) {
  const db = await getDbClient();

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

  const countRs = await db.execute({
    sql: `SELECT COUNT(*) as total FROM orders o LEFT JOIN products p ON p.sku = o.sku WHERE ${whereClause}`,
    args: params,
  });
  const total = Number(countRs.rows[0].total || 0);

  const offset = (filters.page - 1) * filters.pageSize;

  let orderColumn = "o.order_date";
  if (filters.sortBy === "order_amount") orderColumn = "o.order_amount";
  else if (filters.sortBy === "quantity") orderColumn = "o.quantity";
  else if (filters.sortBy === "order_id") orderColumn = "o.order_id";
  const orderDir = filters.sortDir.toUpperCase() === "ASC" ? "ASC" : "DESC";

  const ordersRs = await db.execute({
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
      ORDER BY ${orderColumn} ${orderDir}, o.id DESC
      LIMIT ? OFFSET ?
    `,
    args: [...params, filters.pageSize, offset],
  });

  const data = ordersRs.rows.map((row: any) => ({
    order_id: String(row.order_id),
    order_date: String(row.order_date),
    marketplace: String(row.marketplace),
    sku: String(row.sku),
    product_name: String(row.product_name),
    category: String(row.category),
    quantity: Number(row.quantity),
    selling_price: Number(row.selling_price),
    order_amount: Number(row.order_amount),
    order_status: String(row.order_status),
    final_warehouse: String(row.final_warehouse),
    available_stock: Number(row.available_stock),
  }));

  return {
    data,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.ceil(total / filters.pageSize),
  };
}

export async function getProducts(filters: ProductsFilters) {
  const db = await getDbClient();

  const conditions: string[] = ["1=1"];
  const params: any[] = [];

  if (filters.category) { conditions.push("p.category = ?"); params.push(filters.category); }
  if (filters.sku) { conditions.push("p.sku LIKE ?"); params.push(`%${filters.sku}%`); }
  if (filters.search) {
    conditions.push("(p.sku LIKE ? OR p.product_name LIKE ?)");
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  const whereClause = conditions.join(" AND ");

  const countRs = await db.execute({
    sql: `SELECT COUNT(*) as total FROM products p WHERE ${whereClause}`,
    args: params,
  });
  const total = Number(countRs.rows[0].total || 0);

  const offset = (filters.page - 1) * filters.pageSize;

  const productsRs = await db.execute({
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
        SELECT sku, SUM(available_quantity) as total_stock, COUNT(DISTINCT warehouse) as warehouse_count
        FROM inventory GROUP BY sku
      ) inv ON inv.sku = p.sku
      LEFT JOIN (
        SELECT
          sku,
          SUM(CASE WHEN order_status NOT IN ('Cancelled', 'Returned') THEN quantity ELSE 0 END) as sold_quantity,
          SUM(CASE WHEN order_status NOT IN ('Cancelled', 'Returned') THEN order_amount ELSE 0 END) as sales_amount,
          SUM(CASE WHEN order_status = 'Returned' THEN quantity ELSE 0 END) as returned_quantity,
          SUM(CASE WHEN order_status = 'Returned' THEN order_amount ELSE 0 END) as return_amount,
          (
            SELECT marketplace FROM orders o2
            WHERE o2.sku = o1.sku AND o2.order_status NOT IN ('Cancelled', 'Returned')
            GROUP BY marketplace ORDER BY SUM(order_amount) DESC LIMIT 1
          ) as top_marketplace
        FROM orders o1 GROUP BY sku
      ) ord ON ord.sku = p.sku
      WHERE ${whereClause}
      ORDER BY p.sku ASC
      LIMIT ? OFFSET ?
    `,
    args: [...params, filters.pageSize, offset],
  });

  const data = productsRs.rows.map((row: any) => ({
    sku: String(row.sku),
    product_name: String(row.product_name),
    category: String(row.category),
    sold_quantity: Number(row.sold_quantity),
    sales_amount: Number(Number(row.sales_amount).toFixed(2)),
    returned_quantity: Number(row.returned_quantity),
    return_amount: Number(Number(row.return_amount).toFixed(2)),
    total_stock: Number(row.total_stock),
    warehouse_count: Number(row.warehouse_count),
    top_marketplace: String(row.top_marketplace || "-"),
  }));

  return {
    data,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.ceil(total / filters.pageSize),
  };
}

export async function getInventory(filters: InventoryFilters) {
  const db = await getDbClient();

  const summaryRs = await db.execute(`
    SELECT
      COUNT(DISTINCT sku) as total_skus,
      COALESCE(SUM(available_quantity), 0) as total_stock,
      COUNT(DISTINCT warehouse) as warehouse_count
    FROM inventory
  `);
  const totalSkus = Number(summaryRs.rows[0].total_skus || 0);
  const totalStock = Number(summaryRs.rows[0].total_stock || 0);
  const warehouseCount = Number(summaryRs.rows[0].warehouse_count || 0);

  const lowStockRs = await db.execute(`
    SELECT COUNT(*) as count FROM (
      SELECT sku, SUM(available_quantity) as total, MAX(reorder_level) as reorder
      FROM inventory GROUP BY sku HAVING total > 0 AND total <= reorder
    )
  `);
  const lowStockItems = Number(lowStockRs.rows[0].count || 0);

  const outOfStockRs = await db.execute(`
    SELECT COUNT(*) as count FROM (
      SELECT sku, SUM(available_quantity) as total FROM inventory GROUP BY sku HAVING total = 0
    )
  `);
  const outOfStockItems = Number(outOfStockRs.rows[0].count || 0);

  const conditions: string[] = ["1=1"];
  const params: any[] = [];

  if (filters.warehouse) { conditions.push("i.warehouse = ?"); params.push(filters.warehouse); }
  if (filters.status) { conditions.push("i.inventory_status = ?"); params.push(filters.status); }
  if (filters.search) {
    conditions.push("(i.sku LIKE ? OR p.product_name LIKE ?)");
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  const whereClause = conditions.join(" AND ");

  const countRs = await db.execute({
    sql: `SELECT COUNT(*) as total FROM inventory i LEFT JOIN products p ON p.sku = i.sku WHERE ${whereClause}`,
    args: params,
  });
  const total = Number(countRs.rows[0].total || 0);

  const offset = (filters.page - 1) * filters.pageSize;

  const itemsRs = await db.execute({
    sql: `
      SELECT
        i.sku,
        COALESCE(p.product_name, 'Unknown Product') as product_name,
        COALESCE(p.category, 'General') as category,
        i.warehouse,
        i.available_quantity,
        i.reorder_level,
        i.inventory_status,
        i.last_updated
      FROM inventory i
      LEFT JOIN products p ON p.sku = i.sku
      WHERE ${whereClause}
      ORDER BY i.sku ASC, i.warehouse ASC
      LIMIT ? OFFSET ?
    `,
    args: [...params, filters.pageSize, offset],
  });

  const data = itemsRs.rows.map((row: any) => ({
    sku: String(row.sku),
    product_name: String(row.product_name),
    category: String(row.category),
    warehouse: String(row.warehouse),
    available_quantity: Number(row.available_quantity),
    reorder_level: Number(row.reorder_level),
    inventory_status: String(row.inventory_status),
    last_updated: String(row.last_updated),
  }));

  return {
    summary: { totalSkus, totalStock, lowStockItems, outOfStockItems, warehouseCount },
    data,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.ceil(total / filters.pageSize),
  };
}

export async function getFilterOptions() {
  const db = await getDbClient();

  const [marketplacesRs, warehousesRs, categoriesRs] = await Promise.all([
    db.execute("SELECT DISTINCT marketplace FROM orders WHERE marketplace IS NOT NULL ORDER BY marketplace"),
    db.execute("SELECT DISTINCT final_warehouse FROM orders WHERE final_warehouse IS NOT NULL ORDER BY final_warehouse"),
    db.execute("SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category"),
  ]);

  return {
    marketplaces: marketplacesRs.rows.map(r => String(r.marketplace)),
    warehouses: warehousesRs.rows.map(r => String(r.final_warehouse)),
    categories: categoriesRs.rows.map(r => String(r.category)),
  };
}

export async function getDatabaseCounts() {
  const db = await getDbClient();
  const [pRs, oRs, iRs] = await Promise.all([
    db.execute("SELECT COUNT(*) as count FROM products"),
    db.execute("SELECT COUNT(*) as count FROM orders"),
    db.execute("SELECT COUNT(*) as count FROM inventory"),
  ]);

  return {
    products: Number(pRs.rows[0].count || 0),
    orders: Number(oRs.rows[0].count || 0),
    inventory: Number(iRs.rows[0].count || 0),
  };
}
