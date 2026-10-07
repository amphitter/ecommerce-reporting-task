import { getDbClient } from "./engine";
import { getSupabase, isSupabaseConfigured, isSupabaseReady } from "../supabase/server";
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
  if (await isSupabaseReady()) {
    try {
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

      if (!error && data && data.kpis && (data.kpis.totalSales > 0 || data.kpis.totalUnitsSold > 0)) {
        return data as DashboardResponse;
      }

      // If RPC returned empty, check if orders actually exist in Supabase
      const { count: orderCount } = await supabase.from("orders").select("id", { count: "exact", head: true });
      if (orderCount && orderCount > 0) {
        // Direct Supabase calculation with fresh builder per batch to prevent query mutation
        const getBatch = (fromIdx: number, toIdx: number) => {
          let q = supabase.from("orders").select(
            "order_id, order_date, marketplace, sku, category, quantity, order_amount, order_status, final_warehouse"
          );
          if (filters.from) q = q.gte("order_date", filters.from);
          if (filters.to) q = q.lte("order_date", filters.to);
          if (filters.marketplace) q = q.eq("marketplace", filters.marketplace);
          if (filters.warehouse) q = q.eq("final_warehouse", filters.warehouse);
          if (filters.category) q = q.eq("category", filters.category);
          if (filters.status) q = q.eq("order_status", filters.status);
          if (filters.sku) q = q.ilike("sku", `%${filters.sku}%`);
          return q.range(fromIdx, toIdx);
        };

        // Fetch up to 10,000 orders in batches of 1,000 to circumvent PostgREST 1,000 limit
        const orderBatches = await Promise.all([
          getBatch(0, 999),
          getBatch(1000, 1999),
          getBatch(2000, 2999),
          getBatch(3000, 3999),
          getBatch(4000, 4999),
          getBatch(5000, 5999),
        ]);

        const allOrders: any[] = [];
        orderBatches.forEach(b => {
          if (b.data) allOrders.push(...b.data);
        });

        if (allOrders.length > 0) {
          // Fetch inventory aggregated by SKU
          const { data: invRows } = await supabase.from("inventory").select("sku, available_quantity");
          const invStockMap = new Map<string, number>();
          (invRows || []).forEach((r: any) => {
            invStockMap.set(r.sku, (invStockMap.get(r.sku) || 0) + Number(r.available_quantity));
          });

          // Fetch products map
          const { data: prodRows } = await supabase.from("products").select("sku, product_name");
          const prodNameMap = new Map<string, string>();
          (prodRows || []).forEach((p: any) => {
            prodNameMap.set(p.sku, p.product_name);
          });

          let totalSales = 0;
          let totalReturnAmount = 0;
          let totalUnitsSold = 0;
          let totalUnitsReturned = 0;
          const validOrderIds = new Set<string>();

          const productSales = new Map<string, { sales: number; units: number; returns: number; cat: string }>();
          const productReturnsAmount = new Map<string, number>();
          const productReturnsQty = new Map<string, number>();
          const warehouseMap = new Map<string, { sales: number; units: number }>();
          const dailyMap = new Map<string, { sales: number; returns: number; units: number }>();

          let minDateStr = allOrders[0].order_date;
          let maxDateStr = allOrders[0].order_date;

          for (const o of allOrders) {
            const isValid = !["Cancelled", "Returned"].includes(o.order_status);
            const isRet = o.order_status === "Returned";
            const amt = Number(o.order_amount);
            const qty = Number(o.quantity);

            if (o.order_date < minDateStr) minDateStr = o.order_date;
            if (o.order_date > maxDateStr) maxDateStr = o.order_date;

            if (isValid) {
              totalSales += amt;
              totalUnitsSold += qty;
              validOrderIds.add(o.order_id);

              const ps = productSales.get(o.sku) || { sales: 0, units: 0, returns: 0, cat: o.category };
              ps.sales += amt;
              ps.units += qty;
              productSales.set(o.sku, ps);

              const wh = warehouseMap.get(o.final_warehouse) || { sales: 0, units: 0 };
              wh.sales += amt;
              wh.units += qty;
              warehouseMap.set(o.final_warehouse, wh);

              const day = dailyMap.get(o.order_date) || { sales: 0, returns: 0, units: 0 };
              day.sales += amt;
              day.units += qty;
              dailyMap.set(o.order_date, day);
            }

            if (isRet) {
              totalReturnAmount += amt;
              totalUnitsReturned += qty;

              productReturnsAmount.set(o.sku, (productReturnsAmount.get(o.sku) || 0) + amt);
              productReturnsQty.set(o.sku, (productReturnsQty.get(o.sku) || 0) + qty);

              const ps = productSales.get(o.sku) || { sales: 0, units: 0, returns: 0, cat: o.category };
              ps.returns += amt;
              productSales.set(o.sku, ps);

              const day = dailyMap.get(o.order_date) || { sales: 0, returns: 0, units: 0 };
              day.returns += amt;
              dailyMap.set(o.order_date, day);
            }
          }

          const validOrderCount = validOrderIds.size;
          const averageOrderValue = validOrderCount > 0 ? Number((totalSales / validOrderCount).toFixed(2)) : 0;
          const returnRate = totalUnitsSold > 0 ? Number((totalUnitsReturned / totalUnitsSold).toFixed(4)) : 0;

          const dMin = new Date(filters.from || minDateStr);
          const dMax = new Date(filters.to || maxDateStr);
          const diffDays = Math.max(1, Math.round((dMax.getTime() - dMin.getTime()) / (1000 * 60 * 60 * 24)) + 1);
          const averageConsumptionPerDay = Number((totalUnitsSold / diffDays).toFixed(2));

          // Highest selling product by sales amount
          let topSellingSku = "";
          let maxSalesAmt = -1;
          productSales.forEach((v, k) => {
            if (v.sales > maxSalesAmt) {
              maxSalesAmt = v.sales;
              topSellingSku = k;
            }
          });

          const highestSellingProduct = topSellingSku ? {
            sku: topSellingSku,
            product_name: prodNameMap.get(topSellingSku) || "Product",
            sales_amount: maxSalesAmt,
            units_sold: productSales.get(topSellingSku)!.units,
          } : null;

          // Highest return by amount
          let topRetAmtSku = "";
          let maxRetAmt = -1;
          productReturnsAmount.forEach((v, k) => {
            if (v > maxRetAmt) { maxRetAmt = v; topRetAmtSku = k; }
          });
          const highestReturnProductByAmount = topRetAmtSku ? {
            sku: topRetAmtSku,
            product_name: prodNameMap.get(topRetAmtSku) || "Product",
            return_amount: maxRetAmt,
          } : null;

          // Highest return by quantity
          let topRetQtySku = "";
          let maxRetQty = -1;
          productReturnsQty.forEach((v, k) => {
            if (v > maxRetQty) { maxRetQty = v; topRetQtySku = k; }
          });
          const highestReturnProductByQuantity = topRetQtySku ? {
            sku: topRetQtySku,
            product_name: prodNameMap.get(topRetQtySku) || "Product",
            return_units: maxRetQty,
          } : null;

          // Lowest and highest stock products
          let lowestStockSku = "";
          let minStock = Infinity;
          let highestStockSku = "";
          let maxStock = -1;
          invStockMap.forEach((v, k) => {
            if (v < minStock) { minStock = v; lowestStockSku = k; }
            if (v > maxStock) { maxStock = v; highestStockSku = k; }
          });

          const lowestStockProduct = lowestStockSku ? {
            sku: lowestStockSku,
            product_name: prodNameMap.get(lowestStockSku) || "Product",
            total_stock: minStock,
          } : null;

          const highestStockProduct = highestStockSku ? {
            sku: highestStockSku,
            product_name: prodNameMap.get(highestStockSku) || "Product",
            total_stock: maxStock,
          } : null;

          // Warehouse Sales
          const warehouseSales = [...warehouseMap.entries()].map(([warehouse, val]) => ({
            warehouse,
            sales: Number(val.sales.toFixed(2)),
            units: val.units,
            percentage: totalSales > 0 ? Number(((val.sales / totalSales) * 100).toFixed(1)) : 0,
          })).sort((a, b) => b.sales - a.sales);

          // Sales Trend
          const salesTrend = [...dailyMap.entries()].map(([date, val]) => ({
            date,
            sales: Number(val.sales.toFixed(2)),
            returns: Number(val.returns.toFixed(2)),
            units: val.units,
          })).sort((a, b) => a.date.localeCompare(b.date));

          // Top 5 Products
          const topProducts = [...productSales.entries()]
            .sort((a, b) => b[1].sales - a[1].sales)
            .slice(0, 5)
            .map(([sku, val]) => ({
              sku,
              product_name: prodNameMap.get(sku) || "Product",
              category: val.cat,
              sales: Number(val.sales.toFixed(2)),
              units: val.units,
              returns: Number(val.returns.toFixed(2)),
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
      }
    } catch (err) {
      console.warn("Supabase getDashboardMetrics failed, falling back to local DB:", err);
    }
  }

  // Local SQLite Engine fallback
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
  if (await isSupabaseReady()) {
    try {
      const supabase = getSupabase()!;
      const offset = (filters.page - 1) * filters.pageSize;

      // Inventory aggregated by SKU first to avoid duplicate join counts
      const { data: invRows, error: invErr } = await supabase.from("inventory").select("sku, available_quantity");
      if (invErr) throw invErr;
      const stockMap = new Map<string, number>();
      (invRows || []).forEach((r: any) => {
        stockMap.set(r.sku, (stockMap.get(r.sku) || 0) + Number(r.available_quantity));
      });

      // Product names map
      const { data: prodRows, error: prodErr } = await supabase.from("products").select("sku, product_name");
      if (prodErr) throw prodErr;
      const nameMap = new Map<string, string>();
      (prodRows || []).forEach((p: any) => {
        nameMap.set(p.sku, p.product_name);
      });

      let query = supabase.from("orders").select(
        "order_id, order_date, marketplace, sku, category, quantity, selling_price, order_amount, order_status, final_warehouse",
        { count: "exact" }
      );

      if (filters.from) query = query.gte("order_date", filters.from);
      if (filters.to) query = query.lte("order_date", filters.to);
      if (filters.marketplace) query = query.eq("marketplace", filters.marketplace);
      if (filters.warehouse) query = query.eq("final_warehouse", filters.warehouse);
      if (filters.category) query = query.eq("category", filters.category);
      if (filters.status) query = query.eq("order_status", filters.status);
      if (filters.sku) query = query.ilike("sku", `%${filters.sku}%`);
      if (filters.search) {
        query = query.or(`order_id.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`);
      }

      const sortCol = filters.sortBy === "order_amount" || filters.sortBy === "quantity" ? filters.sortBy : "order_date";
      query = query
        .order(sortCol, { ascending: filters.sortDir === "asc" })
        .range(offset, offset + filters.pageSize - 1);

      const { data, count, error } = await query;
      if (error) throw error;

      const orders = (data || []).map((row: any) => ({
        order_id: row.order_id,
        order_date: row.order_date,
        marketplace: row.marketplace,
        sku: row.sku,
        product_name: nameMap.get(row.sku) || "Product",
        category: row.category,
        quantity: Number(row.quantity),
        selling_price: Number(row.selling_price),
        order_amount: Number(row.order_amount),
        order_status: row.order_status,
        final_warehouse: row.final_warehouse,
        available_stock: stockMap.get(row.sku) || 0,
      }));

      return {
        data: orders,
        total: count || 0,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages: Math.ceil((count || 0) / filters.pageSize),
      };
    } catch (err) {
      console.warn("Supabase getOrders failed, falling back to local DB:", err);
    }
  }

  // Local fallback
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
  if (await isSupabaseReady()) {
    try {
      const supabase = getSupabase()!;
      const offset = (filters.page - 1) * filters.pageSize;

      // Inventory aggregated by SKU first
      const { data: invRows, error: invErr } = await supabase.from("inventory").select("sku, available_quantity, warehouse");
      if (invErr) throw invErr;
      const invAgg = new Map<string, { total: number; warehouses: Set<string> }>();
      (invRows || []).forEach((r: any) => {
        const existing = invAgg.get(r.sku) || { total: 0, warehouses: new Set() };
        existing.total += Number(r.available_quantity);
        existing.warehouses.add(r.warehouse);
        invAgg.set(r.sku, existing);
      });

      // Orders aggregated by SKU
      const { data: ordRows, error: ordErr } = await supabase.from("orders").select("sku, order_status, quantity, order_amount, marketplace");
      if (ordErr) throw ordErr;
      const ordAgg = new Map<string, any>();
      (ordRows || []).forEach((o: any) => {
        const existing = ordAgg.get(o.sku) || { sold: 0, sales: 0, retQty: 0, retAmount: 0, mpSales: new Map() };
        const isValid = !["Cancelled", "Returned"].includes(o.order_status);
        const isRet = o.order_status === "Returned";
        if (isValid) {
          existing.sold += Number(o.quantity);
          existing.sales += Number(o.order_amount);
          const mps = existing.mpSales.get(o.marketplace) || 0;
          existing.mpSales.set(o.marketplace, mps + Number(o.order_amount));
        }
        if (isRet) {
          existing.retQty += Number(o.quantity);
          existing.retAmount += Number(o.order_amount);
        }
        ordAgg.set(o.sku, existing);
      });

      let query = supabase.from("products").select("sku, product_name, category", { count: "exact" });
      if (filters.category) query = query.eq("category", filters.category);
      if (filters.sku) query = query.ilike("sku", `%${filters.sku}%`);
      if (filters.search) {
        query = query.or(`sku.ilike.%${filters.search}%,product_name.ilike.%${filters.search}%`);
      }

      query = query.order("sku", { ascending: true }).range(offset, offset + filters.pageSize - 1);
      const { data, count, error } = await query;
      if (error) throw error;

      const products = (data || []).map((p: any) => {
        const inv = invAgg.get(p.sku) || { total: 0, warehouses: new Set() };
        const ord = ordAgg.get(p.sku) || { sold: 0, sales: 0, retQty: 0, retAmount: 0, mpSales: new Map() };

        let topMp = "-";
        let topVal = 0;
        ord.mpSales.forEach((v: number, k: string) => {
          if (v > topVal) { topVal = v; topMp = k; }
        });

        return {
          sku: p.sku,
          product_name: p.product_name,
          category: p.category,
          sold_quantity: ord.sold,
          sales_amount: Number(ord.sales.toFixed(2)),
          returned_quantity: ord.retQty,
          return_amount: Number(ord.retAmount.toFixed(2)),
          total_stock: inv.total,
          warehouse_count: inv.warehouses.size,
          top_marketplace: topMp,
        };
      });

      return {
        data: products,
        total: count || 0,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages: Math.ceil((count || 0) / filters.pageSize),
      };
    } catch (err) {
      console.warn("Supabase getProducts failed, falling back to local DB:", err);
    }
  }

  // Local fallback
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
  if (await isSupabaseReady()) {
    try {
      const supabase = getSupabase()!;
      const offset = (filters.page - 1) * filters.pageSize;

      // Summary calculation
      const { data: invAll, error: invAllErr } = await supabase.from("inventory").select("sku, warehouse, available_quantity, reorder_level");
      if (invAllErr) throw invAllErr;
      const skus = new Set<string>();
      const warehouses = new Set<string>();
      let totalStock = 0;
      const skuTotals = new Map<string, { total: number; reorder: number }>();

      (invAll || []).forEach((r: any) => {
        skus.add(r.sku);
        warehouses.add(r.warehouse);
        totalStock += Number(r.available_quantity);
        const curr = skuTotals.get(r.sku) || { total: 0, reorder: Number(r.reorder_level) };
        curr.total += Number(r.available_quantity);
        curr.reorder = Math.max(curr.reorder, Number(r.reorder_level));
        skuTotals.set(r.sku, curr);
      });

      let lowStockItems = 0;
      let outOfStockItems = 0;
      skuTotals.forEach(({ total, reorder }) => {
        if (total === 0) outOfStockItems++;
        else if (total <= reorder) lowStockItems++;
      });

      // Product names & categories map
      const { data: prodRows, error: prodErr } = await supabase.from("products").select("sku, product_name, category");
      if (prodErr) throw prodErr;
      const prodMap = new Map<string, { name: string; cat: string }>();
      (prodRows || []).forEach((p: any) => {
        prodMap.set(p.sku, { name: p.product_name, cat: p.category });
      });

      let query = supabase.from("inventory").select(
        "sku, warehouse, available_quantity, reorder_level, inventory_status, last_updated",
        { count: "exact" }
      );

      if (filters.warehouse) query = query.eq("warehouse", filters.warehouse);
      if (filters.status) query = query.eq("inventory_status", filters.status);
      if (filters.search) query = query.ilike("sku", `%${filters.search}%`);

      query = query.order("sku", { ascending: true }).order("warehouse", { ascending: true }).range(offset, offset + filters.pageSize - 1);
      const { data, count, error } = await query;
      if (error) throw error;

      const items = (data || []).map((row: any) => {
        const p = prodMap.get(row.sku) || { name: "Product", cat: "General" };
        return {
          sku: row.sku,
          product_name: p.name,
          category: p.cat,
          warehouse: row.warehouse,
          available_quantity: Number(row.available_quantity),
          reorder_level: Number(row.reorder_level),
          inventory_status: row.inventory_status,
          last_updated: row.last_updated,
        };
      });

      return {
        summary: {
          totalSkus: skus.size,
          totalStock,
          lowStockItems,
          outOfStockItems,
          warehouseCount: warehouses.size,
        },
        data: items,
        total: count || 0,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages: Math.ceil((count || 0) / filters.pageSize),
      };
    } catch (err) {
      console.warn("Supabase getInventory failed, falling back to local DB:", err);
    }
  }

  // Local fallback
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
  if (await isSupabaseReady()) {
    try {
      const supabase = getSupabase()!;

      // 1. Try RPC first if defined
      const { data: rpcData, error: rpcErr } = await supabase.rpc("get_distinct_filter_options");
      if (!rpcErr && rpcData && rpcData.marketplaces && rpcData.marketplaces.length > 0) {
        return {
          marketplaces: (rpcData.marketplaces || []).filter(Boolean).sort(),
          warehouses: (rpcData.warehouses || []).filter(Boolean).sort(),
          categories: (rpcData.categories || []).filter(Boolean).sort(),
        };
      }

      // 2. Fetch from dedicated tables & distinct scans
      const [mpRs, whRs, catRs] = await Promise.all([
        supabase.from("marketplaces").select("code"),
        supabase.from("warehouses").select("code"),
        supabase.from("products").select("category").limit(2000),
      ]);

      const marketplaceSet = new Set<string>();
      (mpRs.data || []).forEach((r: any) => { if (r.code) marketplaceSet.add(r.code); });

      // If marketplaces table wasn't seeded yet, query candidate marketplaces
      if (marketplaceSet.size < 5) {
        const defaultMarketplaces = ["Amazon", "Flipkart", "Meesho", "Myntra", "Shopify"];
        await Promise.all(defaultMarketplaces.map(async (m) => {
          const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("marketplace", m);
          if (count && count > 0) marketplaceSet.add(m);
        }));
      }

      const warehouseSet = new Set<string>();
      (whRs.data || []).forEach((r: any) => { if (r.code) warehouseSet.add(r.code); });
      if (warehouseSet.size < 4) {
        const defaultWarehouses = ["WH-EAST", "WH-NORTH", "WH-SOUTH", "WH-WEST"];
        await Promise.all(defaultWarehouses.map(async (w) => {
          const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("final_warehouse", w);
          if (count && count > 0) warehouseSet.add(w);
        }));
      }

      const categorySet = new Set<string>();
      (catRs.data || []).forEach((r: any) => { if (r.category) categorySet.add(r.category); });

      return {
        marketplaces: [...marketplaceSet].sort(),
        warehouses: [...warehouseSet].sort(),
        categories: [...categorySet].sort(),
      };
    } catch (err) {
      console.warn("Supabase getFilterOptions failed, falling back to local DB:", err);
    }
  }

  const db = await getDbClient();

  const [marketplacesRs, warehousesRs, categoriesRs] = await Promise.all([
    db.execute("SELECT DISTINCT marketplace FROM orders WHERE marketplace IS NOT NULL ORDER BY marketplace"),
    db.execute("SELECT DISTINCT final_warehouse FROM orders WHERE final_warehouse IS NOT NULL ORDER BY final_warehouse"),
    db.execute("SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category"),
  ]);

  const mpList = [...new Set(marketplacesRs.rows.map(r => String(r.marketplace)).filter(Boolean))];
  if (mpList.length === 0) {
    ["Amazon", "Flipkart", "Meesho", "Myntra", "Shopify"].forEach(m => mpList.push(m));
  }

  const whList = [...new Set(warehousesRs.rows.map(r => String(r.final_warehouse)).filter(Boolean))];
  if (whList.length === 0) {
    ["WH-EAST", "WH-NORTH", "WH-SOUTH", "WH-WEST"].forEach(w => whList.push(w));
  }

  return {
    marketplaces: mpList.sort(),
    warehouses: whList.sort(),
    categories: categoriesRs.rows.map(r => String(r.category)).sort(),
  };
}

export async function getDatabaseCounts() {
  if (await isSupabaseReady()) {
    try {
      const supabase = getSupabase()!;
      const [pRs, oRs, iRs] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id", { count: "exact", head: true }),
        supabase.from("inventory").select("id", { count: "exact", head: true }),
      ]);

      if (!pRs.error && !oRs.error && !iRs.error) {
        return {
          products: pRs.count || 0,
          orders: oRs.count || 0,
          inventory: iRs.count || 0,
        };
      }
    } catch (err) {
      console.warn("Supabase getDatabaseCounts failed, falling back to local DB:", err);
    }
  }

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
