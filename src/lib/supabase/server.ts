import { createClient, SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";

let supabaseInstance: SupabaseClient | null = null;
let tablesReadyCache: boolean | null = null;
let lastCheckTime = 0;
let migrationAttempted = false;

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  return Boolean(
    url &&
    key &&
    url.trim().startsWith("http") &&
    key.trim().length > 10 &&
    !url.includes("your-project")
  );
}

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseInstance) {
    const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)!.trim();
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)!.trim();
    supabaseInstance = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabaseInstance;
}

export async function tryAutoMigrate(): Promise<boolean> {
  const pgUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  if (!pgUrl) return false;

  try {
    const sql = postgres(pgUrl, { ssl: "require", max: 1 });

    // 1. Core Tables
    await sql`
      CREATE TABLE IF NOT EXISTS warehouses (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS marketplaces (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        product_id TEXT UNIQUE NOT NULL,
        sku TEXT UNIQUE NOT NULL,
        product_name TEXT NOT NULL,
        category TEXT NOT NULL,
        brand TEXT NOT NULL,
        selling_price NUMERIC(12,2) NOT NULL CHECK (selling_price >= 0),
        cost_price NUMERIC(12,2) NOT NULL CHECK (cost_price >= 0),
        default_warehouse TEXT NOT NULL,
        active CHAR(1) DEFAULT 'Y' NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_id TEXT UNIQUE NOT NULL,
        order_date DATE NOT NULL,
        marketplace TEXT NOT NULL,
        sku TEXT NOT NULL,
        product_id TEXT NOT NULL,
        category TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        selling_price NUMERIC(12,2) NOT NULL CHECK (selling_price >= 0),
        order_amount NUMERIC(12,2) NOT NULL CHECK (order_amount >= 0),
        order_status TEXT NOT NULL,
        allocated_warehouse TEXT,
        default_warehouse TEXT,
        final_warehouse TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS inventory (
        id SERIAL PRIMARY KEY,
        sku TEXT NOT NULL,
        product_id TEXT NOT NULL,
        warehouse TEXT NOT NULL,
        available_quantity INTEGER NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
        reorder_level INTEGER NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
        inventory_status TEXT NOT NULL,
        last_updated DATE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(sku, warehouse)
      );
    `;

    // 2. Populate marketplaces from existing orders + default catalog
    await sql`
      INSERT INTO marketplaces (code)
      VALUES ('Amazon'), ('Flipkart'), ('Meesho'), ('Myntra'), ('Shopify')
      ON CONFLICT (code) DO NOTHING;
    `;

    await sql`
      INSERT INTO marketplaces (code)
      SELECT DISTINCT marketplace FROM orders
      WHERE marketplace IS NOT NULL AND marketplace != ''
      ON CONFLICT (code) DO NOTHING;
    `;

    // 3. Indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_orders_sku ON orders(sku);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_orders_marketplace ON orders(marketplace);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_orders_final_warehouse ON orders(final_warehouse);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON inventory(warehouse);`;

    // 4. Function: get_distinct_filter_options
    await sql`
      CREATE OR REPLACE FUNCTION get_distinct_filter_options()
      RETURNS JSONB AS $$
      BEGIN
        RETURN jsonb_build_object(
          'marketplaces', (
            SELECT COALESCE(jsonb_agg(DISTINCT code ORDER BY code), '[]'::jsonb)
            FROM (
              SELECT code FROM marketplaces
              UNION
              SELECT DISTINCT marketplace AS code FROM orders WHERE marketplace IS NOT NULL AND marketplace != ''
            ) m
          ),
          'warehouses', (
            SELECT COALESCE(jsonb_agg(DISTINCT code ORDER BY code), '[]'::jsonb)
            FROM (
              SELECT code FROM warehouses
              UNION
              SELECT DISTINCT final_warehouse AS code FROM orders WHERE final_warehouse IS NOT NULL AND final_warehouse != ''
              UNION
              SELECT DISTINCT warehouse AS code FROM inventory WHERE warehouse IS NOT NULL AND warehouse != ''
            ) w
          ),
          'categories', (
            SELECT COALESCE(jsonb_agg(DISTINCT category ORDER BY category), '[]'::jsonb)
            FROM products WHERE category IS NOT NULL AND category != ''
          )
        );
      END;
      $$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
    `;

    // 5. Function: get_dashboard_metrics
    await sql`
      CREATE OR REPLACE FUNCTION get_dashboard_metrics(
          p_from DATE DEFAULT NULL,
          p_to DATE DEFAULT NULL,
          p_marketplace TEXT DEFAULT NULL,
          p_warehouse TEXT DEFAULT NULL,
          p_sku TEXT DEFAULT NULL,
          p_category TEXT DEFAULT NULL,
          p_status TEXT DEFAULT NULL
      )
      RETURNS JSONB AS $$
      DECLARE
          v_result JSONB;
          v_date_min DATE;
          v_date_max DATE;
          v_days INTEGER;
      BEGIN
          SELECT COALESCE(p_from, MIN(order_date)), COALESCE(p_to, MAX(order_date))
          INTO v_date_min, v_date_max
          FROM orders;

          IF v_date_min IS NULL THEN
              RETURN jsonb_build_object(
                  'kpis', jsonb_build_object(
                      'totalSales', 0, 'totalReturnAmount', 0, 'totalUnitsSold', 0,
                      'totalUnitsReturned', 0, 'highestReturnProductByAmount', null,
                      'highestReturnProductByQuantity', null, 'lowestStockProduct', null,
                      'highestStockProduct', null, 'averageConsumptionPerDay', 0,
                      'highestSellingProduct', null, 'returnRate', 0, 'averageOrderValue', 0
                  ),
                  'warehouseSales', '[]'::jsonb,
                  'salesTrend', '[]'::jsonb,
                  'topProducts', '[]'::jsonb
              );
          END IF;

          v_days := GREATEST(v_date_max - v_date_min + 1, 1);

          WITH filtered_orders AS (
              SELECT
                  o.order_id,
                  o.order_date,
                  o.marketplace,
                  o.sku,
                  o.product_id,
                  o.category,
                  o.quantity,
                  o.order_amount,
                  o.order_status,
                  o.final_warehouse,
                  CASE WHEN o.order_status NOT IN ('Cancelled', 'Returned') THEN o.order_amount ELSE 0 END AS valid_sales,
                  CASE WHEN o.order_status NOT IN ('Cancelled', 'Returned') THEN o.quantity ELSE 0 END AS valid_units,
                  CASE WHEN o.order_status = 'Returned' THEN o.order_amount ELSE 0 END AS return_amount,
                  CASE WHEN o.order_status = 'Returned' THEN o.quantity ELSE 0 END AS return_units
              FROM orders o
              WHERE o.order_date BETWEEN v_date_min AND v_date_max
                AND (p_marketplace IS NULL OR o.marketplace = p_marketplace)
                AND (p_warehouse IS NULL OR o.final_warehouse = p_warehouse)
                AND (p_sku IS NULL OR o.sku ILIKE '%' || p_sku || '%')
                AND (p_category IS NULL OR o.category = p_category)
                AND (p_status IS NULL OR o.order_status = p_status)
          ),
          inventory_totals AS (
              SELECT
                  sku,
                  SUM(available_quantity) AS total_stock
              FROM inventory
              GROUP BY sku
          ),
          kpi_totals AS (
              SELECT
                  COALESCE(SUM(valid_sales), 0)::NUMERIC AS total_sales,
                  COALESCE(SUM(return_amount), 0)::NUMERIC AS total_return_amount,
                  COALESCE(SUM(valid_units), 0)::INTEGER AS total_units_sold,
                  COALESCE(SUM(return_units), 0)::INTEGER AS total_units_returned,
                  COUNT(DISTINCT CASE WHEN valid_sales > 0 THEN order_id END)::INTEGER AS valid_order_count
              FROM filtered_orders
          ),
          top_selling AS (
              SELECT
                  fo.sku,
                  p.product_name,
                  SUM(fo.valid_sales)::NUMERIC AS sales_amount,
                  SUM(fo.valid_units)::INTEGER AS units_sold
              FROM filtered_orders fo
              LEFT JOIN products p ON p.sku = fo.sku
              WHERE fo.valid_sales > 0
              GROUP BY fo.sku, p.product_name
              ORDER BY sales_amount DESC
              LIMIT 1
          ),
          top_return_amount AS (
              SELECT
                  fo.sku,
                  p.product_name,
                  SUM(fo.return_amount)::NUMERIC AS return_amount
              FROM filtered_orders fo
              LEFT JOIN products p ON p.sku = fo.sku
              WHERE fo.return_amount > 0
              GROUP BY fo.sku, p.product_name
              ORDER BY return_amount DESC
              LIMIT 1
          ),
          top_return_qty AS (
              SELECT
                  fo.sku,
                  p.product_name,
                  SUM(fo.return_units)::INTEGER AS return_units
              FROM filtered_orders fo
              LEFT JOIN products p ON p.sku = fo.sku
              WHERE fo.return_units > 0
              GROUP BY fo.sku, p.product_name
              ORDER BY return_units DESC
              LIMIT 1
          ),
          stock_extremes AS (
              SELECT
                  (SELECT jsonb_build_object('sku', it.sku, 'product_name', p.product_name, 'total_stock', it.total_stock)
                   FROM inventory_totals it
                   LEFT JOIN products p ON p.sku = it.sku
                   ORDER BY it.total_stock ASC
                   LIMIT 1) AS lowest_stock,
                  (SELECT jsonb_build_object('sku', it.sku, 'product_name', p.product_name, 'total_stock', it.total_stock)
                   FROM inventory_totals it
                   LEFT JOIN products p ON p.sku = it.sku
                   ORDER BY it.total_stock DESC
                   LIMIT 1) AS highest_stock
          ),
          warehouse_sales AS (
              SELECT jsonb_agg(
                  jsonb_build_object(
                      'warehouse', fo.final_warehouse,
                      'sales', SUM(fo.valid_sales)::NUMERIC,
                      'units', SUM(fo.valid_units)::INTEGER
                  ) ORDER BY SUM(fo.valid_sales) DESC
              ) AS data
              FROM filtered_orders fo
              WHERE fo.valid_sales > 0
              GROUP BY fo.final_warehouse
          ),
          sales_trend AS (
              SELECT jsonb_agg(
                  jsonb_build_object(
                      'date', to_char(fo.order_date, 'YYYY-MM-DD'),
                      'sales', SUM(fo.valid_sales)::NUMERIC,
                      'returns', SUM(fo.return_amount)::NUMERIC,
                      'units', SUM(fo.valid_units)::INTEGER
                  ) ORDER BY fo.order_date ASC
              ) AS data
              FROM filtered_orders fo
              GROUP BY fo.order_date
          ),
          top_products AS (
              SELECT jsonb_agg(
                  jsonb_build_object(
                      'sku', fo.sku,
                      'product_name', p.product_name,
                      'category', fo.category,
                      'sales', SUM(fo.valid_sales)::NUMERIC,
                      'units', SUM(fo.valid_units)::INTEGER,
                      'returns', SUM(fo.return_amount)::NUMERIC
                  ) ORDER BY SUM(fo.valid_sales) DESC
              ) AS data
              FROM filtered_orders fo
              LEFT JOIN products p ON p.sku = fo.sku
              WHERE fo.valid_sales > 0
              GROUP BY fo.sku, p.product_name, fo.category
              LIMIT 5
          )
          SELECT jsonb_build_object(
              'kpis', jsonb_build_object(
                  'totalSales', kt.total_sales,
                  'totalReturnAmount', kt.total_return_amount,
                  'totalUnitsSold', kt.total_units_sold,
                  'totalUnitsReturned', kt.total_units_returned,
                  'highestReturnProductByAmount', (SELECT row_to_json(tra) FROM top_return_amount tra),
                  'highestReturnProductByQuantity', (SELECT row_to_json(trq) FROM top_return_qty trq),
                  'lowestStockProduct', se.lowest_stock,
                  'highestStockProduct', se.highest_stock,
                  'averageConsumptionPerDay', ROUND(kt.total_units_sold::NUMERIC / v_days, 2),
                  'highestSellingProduct', (SELECT row_to_json(ts) FROM top_selling ts),
                  'returnRate', CASE WHEN kt.total_units_sold > 0 THEN ROUND(kt.total_units_returned::NUMERIC / kt.total_units_sold, 4) ELSE 0 END,
                  'averageOrderValue', CASE WHEN kt.valid_order_count > 0 THEN ROUND(kt.total_sales / kt.valid_order_count, 2) ELSE 0 END
              ),
              'warehouseSales', COALESCE((SELECT data FROM warehouse_sales), '[]'::jsonb),
              'salesTrend', COALESCE((SELECT data FROM sales_trend), '[]'::jsonb),
              'topProducts', COALESCE((SELECT data FROM top_products), '[]'::jsonb)
          )
          INTO v_result
          FROM kpi_totals kt, stock_extremes se;

          RETURN v_result;
      END;
      $$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
    `;

    await sql.end();
    return true;
  } catch (err) {
    console.warn("Auto-migrate via direct Postgres URL error:", err);
    return false;
  }
}

export async function isSupabaseReady(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const now = Date.now();
  if (tablesReadyCache === true && now - lastCheckTime < 15000) {
    return true;
  }

  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from("products").select("id").limit(1);
    if (!error) {
      if (!migrationAttempted) {
        migrationAttempted = true;
        await tryAutoMigrate();
      }
      tablesReadyCache = true;
      lastCheckTime = now;
      return true;
    }

    if (!migrationAttempted) {
      migrationAttempted = true;
      const migrated = await tryAutoMigrate();
      if (migrated) {
        const checkAgain = await supabase.from("products").select("id").limit(1);
        if (!checkAgain.error) {
          tablesReadyCache = true;
          lastCheckTime = now;
          return true;
        }
      }
    }

    tablesReadyCache = false;
    lastCheckTime = now;
    return false;
  } catch {
    tablesReadyCache = false;
    lastCheckTime = now;
    return false;
  }
}
