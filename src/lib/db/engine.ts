import { createClient, Client } from "@libsql/client";
import path from "path";
import fs from "fs";
import os from "os";

let client: Client | null = null;
let initialized = false;

function getDbPath(): string {
  // On Vercel, the workspace directory is read-only.
  // /tmp is the only writable filesystem in serverless functions.
  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), "nexusops.db");
  }

  try {
    const dir = path.resolve(process.cwd(), "data");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return path.join(dir, "nexusops.db");
  } catch {
    return path.join(os.tmpdir(), "nexusops.db");
  }
}

export async function getDbClient(): Promise<Client> {
  if (!client) {
    const dbPath = getDbPath();
    client = createClient({
      url: `file:${dbPath}`,
    });
  }

  if (!initialized) {
    await initTables(client);
    initialized = true;
  }

  return client;
}

async function initTables(c: Client) {
  await c.execute(`
    CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await c.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT UNIQUE NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      product_name TEXT NOT NULL,
      category TEXT NOT NULL,
      brand TEXT NOT NULL,
      selling_price REAL NOT NULL CHECK(selling_price >= 0),
      cost_price REAL NOT NULL CHECK(cost_price >= 0),
      default_warehouse TEXT NOT NULL,
      active TEXT DEFAULT 'Y' NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await c.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT UNIQUE NOT NULL,
      order_date TEXT NOT NULL,
      marketplace TEXT NOT NULL,
      sku TEXT NOT NULL,
      product_id TEXT NOT NULL,
      category TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      selling_price REAL NOT NULL CHECK(selling_price >= 0),
      order_amount REAL NOT NULL CHECK(order_amount >= 0),
      order_status TEXT NOT NULL,
      allocated_warehouse TEXT,
      default_warehouse TEXT,
      final_warehouse TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await c.execute(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL,
      product_id TEXT NOT NULL,
      warehouse TEXT NOT NULL,
      available_quantity INTEGER NOT NULL DEFAULT 0 CHECK(available_quantity >= 0),
      reorder_level INTEGER NOT NULL DEFAULT 0 CHECK(reorder_level >= 0),
      inventory_status TEXT NOT NULL,
      last_updated TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(sku, warehouse)
    );
  `);

  await c.execute(`CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);`);
  await c.execute(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);`);
  await c.execute(`CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);`);
  await c.execute(`CREATE INDEX IF NOT EXISTS idx_orders_sku ON orders(sku);`);
  await c.execute(`CREATE INDEX IF NOT EXISTS idx_orders_marketplace ON orders(marketplace);`);
  await c.execute(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);`);
  await c.execute(`CREATE INDEX IF NOT EXISTS idx_orders_final_wh ON orders(final_warehouse);`);
  await c.execute(`CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);`);
  await c.execute(`CREATE INDEX IF NOT EXISTS idx_inventory_wh ON inventory(warehouse);`);
  await c.execute(`CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(inventory_status);`);
}
