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
    await sql`
      CREATE TABLE IF NOT EXISTS warehouses (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT,
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
    await sql.end();
    return true;
  } catch (err) {
    console.warn("Auto-migrate via direct Postgres URL failed or not configured:", err);
    return false;
  }
}

export async function isSupabaseReady(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const now = Date.now();
  // Check if we already verified recently (cache for 15 seconds)
  if (tablesReadyCache === true && now - lastCheckTime < 15000) {
    return true;
  }

  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from("products").select("id").limit(1);
    if (!error) {
      tablesReadyCache = true;
      lastCheckTime = now;
      return true;
    }

    // If tables are missing, try auto-migrating if connection string exists
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
