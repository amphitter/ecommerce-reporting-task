import { parse } from "csv-parse/sync";
import { getDbClient } from "./engine";
import { getSupabase, isSupabaseConfigured } from "../supabase/server";

export type ImportType = "products" | "orders" | "inventory";

export interface ImportResult {
  success: boolean;
  imported: number;
  invalid: number;
  errors: string[];
  message: string;
}

export function deriveFinalWarehouse(allocated: string | null | undefined, defaultWh: string | null | undefined): string {
  if (allocated && allocated.trim() !== "") return allocated.trim();
  if (defaultWh && defaultWh.trim() !== "") return defaultWh.trim();
  return "Warehouse Not Assigned";
}

function validateProduct(row: any): { valid: boolean; error?: string; data?: any } {
  try {
    if (!row.product_id || !row.sku || !row.product_name || !row.category || !row.brand) {
      return { valid: false, error: "Missing required fields" };
    }
    const sp = Number(row.selling_price);
    const cp = Number(row.cost_price);
    if (isNaN(sp) || isNaN(cp) || sp < 0 || cp < 0) {
      return { valid: false, error: "Invalid price values" };
    }
    return {
      valid: true,
      data: {
        product_id: row.product_id.trim(),
        sku: row.sku.trim(),
        product_name: row.product_name.trim(),
        category: row.category.trim(),
        brand: row.brand.trim(),
        selling_price: sp,
        cost_price: cp,
        default_warehouse: (row.default_warehouse || "").trim() || "Warehouse Not Assigned",
        active: (row.active || "Y").trim().toUpperCase() === "Y" ? "Y" : "N",
      },
    };
  } catch (e) {
    return { valid: false, error: String(e) };
  }
}

function validateOrder(row: any): { valid: boolean; error?: string; data?: any } {
  try {
    if (!row.order_id || !row.order_date || !row.sku || !row.product_id) {
      return { valid: false, error: "Missing required fields" };
    }
    const qty = parseInt(row.quantity, 10);
    const price = Number(row.selling_price);
    const amount = Number(row.order_amount);
    if (isNaN(qty) || qty <= 0 || isNaN(price) || price < 0 || isNaN(amount) || amount < 0) {
      return { valid: false, error: "Invalid numeric values" };
    }
    const date = new Date(row.order_date);
    if (isNaN(date.getTime())) {
      return { valid: false, error: "Invalid date" };
    }

    const allocated = (row.allocated_warehouse || "").trim() || null;
    const defaultWh = (row.default_warehouse || "").trim() || null;
    const finalWh = deriveFinalWarehouse(allocated, defaultWh);

    return {
      valid: true,
      data: {
        order_id: row.order_id.trim(),
        order_date: row.order_date.trim(),
        marketplace: (row.marketplace || "Unknown").trim(),
        sku: row.sku.trim(),
        product_id: row.product_id.trim(),
        category: (row.category || "Unknown").trim(),
        quantity: qty,
        selling_price: price,
        order_amount: amount,
        order_status: (row.order_status || "Unknown").trim(),
        allocated_warehouse: allocated,
        default_warehouse: defaultWh,
        final_warehouse: finalWh,
      },
    };
  } catch (e) {
    return { valid: false, error: String(e) };
  }
}

function validateInventory(row: any): { valid: boolean; error?: string; data?: any } {
  try {
    if (!row.sku || !row.product_id || !row.warehouse) {
      return { valid: false, error: "Missing required fields" };
    }
    const qty = parseInt(row.available_quantity, 10);
    const reorder = parseInt(row.reorder_level, 10);
    if (isNaN(qty) || qty < 0 || isNaN(reorder) || reorder < 0) {
      return { valid: false, error: "Invalid quantity values" };
    }
    let status = (row.inventory_status || "").trim();
    if (!["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"].includes(status)) {
      status = qty === 0 ? "OUT_OF_STOCK" : qty <= reorder ? "LOW_STOCK" : "IN_STOCK";
    }
    return {
      valid: true,
      data: {
        sku: row.sku.trim(),
        product_id: row.product_id.trim(),
        warehouse: row.warehouse.trim(),
        available_quantity: qty,
        reorder_level: reorder,
        inventory_status: status,
        last_updated: (row.last_updated || new Date().toISOString().split("T")[0]).trim(),
      },
    };
  } catch (e) {
    return { valid: false, error: String(e) };
  }
}

export async function importCsv(buffer: Buffer, type: ImportType): Promise<ImportResult> {
  try {
    const records = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const validRows: any[] = [];
    const errors: string[] = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      let result;
      switch (type) {
        case "products":
          result = validateProduct(row);
          break;
        case "orders":
          result = validateOrder(row);
          break;
        case "inventory":
          result = validateInventory(row);
          break;
      }
      if (!result.valid) {
        errors.push(`Row ${i + 2}: ${result.error}`);
        if (errors.length >= 50) {
          errors.push(`... truncated further errors`);
          break;
        }
      } else {
        validRows.push(result.data);
      }
    }

    if (validRows.length === 0) {
      return {
        success: false,
        imported: 0,
        invalid: records.length,
        errors,
        message: "No valid rows found in CSV",
      };
    }

    const useSupabase = isSupabaseConfigured();

    if (useSupabase) {
      const supabase = getSupabase()!;
      const batchSize = 500;
      let imported = 0;

      for (let i = 0; i < validRows.length; i += batchSize) {
        const batch = validRows.slice(i, i + batchSize);
        let upsertError;

        if (type === "products") {
          ({ error: upsertError } = await supabase
            .from("products")
            .upsert(batch, { onConflict: "sku" }));
        } else if (type === "orders") {
          const warehouses = [...new Set(batch.map((r: any) => r.final_warehouse))].map((w: any) => ({
            code: w,
            name: w,
          }));
          await supabase.from("warehouses").upsert(warehouses, { onConflict: "code" });
          ({ error: upsertError } = await supabase
            .from("orders")
            .upsert(batch, { onConflict: "order_id" }));
        } else if (type === "inventory") {
          ({ error: upsertError } = await supabase
            .from("inventory")
            .upsert(batch, { onConflict: "sku,warehouse" }));
        }

        if (upsertError) {
          console.error("Supabase upsert error:", upsertError);
          return {
            success: false,
            imported,
            invalid: validRows.length - imported + errors.length,
            errors: [...errors, `Supabase error: ${upsertError.message}`],
            message: `Import failed: ${upsertError.message}`,
          };
        }

        imported += batch.length;
      }

      return {
        success: true,
        imported,
        invalid: errors.length,
        errors,
        message: `Imported ${imported} ${type} records into Supabase`,
      };
    }

    // Local LibSQL Engine fallback
    const db = await getDbClient();
    const batchSize = 100;
    let imported = 0;

    for (let i = 0; i < validRows.length; i += batchSize) {
      const batch = validRows.slice(i, i + batchSize);

      if (type === "products") {
        for (const r of batch) {
          await db.execute({
            sql: `
              INSERT INTO products (product_id, sku, product_name, category, brand, selling_price, cost_price, default_warehouse, active, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(sku) DO UPDATE SET
                product_id = excluded.product_id,
                product_name = excluded.product_name,
                category = excluded.category,
                brand = excluded.brand,
                selling_price = excluded.selling_price,
                cost_price = excluded.cost_price,
                default_warehouse = excluded.default_warehouse,
                active = excluded.active,
                updated_at = CURRENT_TIMESTAMP
            `,
            args: [r.product_id, r.sku, r.product_name, r.category, r.brand, r.selling_price, r.cost_price, r.default_warehouse, r.active],
          });
        }
      } else if (type === "orders") {
        for (const r of batch) {
          await db.execute({
            sql: `INSERT OR IGNORE INTO warehouses (code, name) VALUES (?, ?)`,
            args: [r.final_warehouse, r.final_warehouse],
          });

          await db.execute({
            sql: `
              INSERT INTO orders (order_id, order_date, marketplace, sku, product_id, category, quantity, selling_price, order_amount, order_status, allocated_warehouse, default_warehouse, final_warehouse)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(order_id) DO UPDATE SET
                order_date = excluded.order_date,
                marketplace = excluded.marketplace,
                sku = excluded.sku,
                product_id = excluded.product_id,
                category = excluded.category,
                quantity = excluded.quantity,
                selling_price = excluded.selling_price,
                order_amount = excluded.order_amount,
                order_status = excluded.order_status,
                allocated_warehouse = excluded.allocated_warehouse,
                default_warehouse = excluded.default_warehouse,
                final_warehouse = excluded.final_warehouse
            `,
            args: [
              r.order_id,
              r.order_date,
              r.marketplace,
              r.sku,
              r.product_id,
              r.category,
              r.quantity,
              r.selling_price,
              r.order_amount,
              r.order_status,
              r.allocated_warehouse,
              r.default_warehouse,
              r.final_warehouse,
            ],
          });
        }
      } else if (type === "inventory") {
        for (const r of batch) {
          await db.execute({
            sql: `
              INSERT INTO inventory (sku, product_id, warehouse, available_quantity, reorder_level, inventory_status, last_updated, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(sku, warehouse) DO UPDATE SET
                product_id = excluded.product_id,
                available_quantity = excluded.available_quantity,
                reorder_level = excluded.reorder_level,
                inventory_status = excluded.inventory_status,
                last_updated = excluded.last_updated,
                updated_at = CURRENT_TIMESTAMP
            `,
            args: [r.sku, r.product_id, r.warehouse, r.available_quantity, r.reorder_level, r.inventory_status, r.last_updated],
          });
        }
      }

      imported += batch.length;
    }

    return {
      success: true,
      imported,
      invalid: errors.length,
      errors,
      message: `Successfully imported ${imported} ${type} records`,
    };
  } catch (error) {
    console.error("Import error:", error);
    return {
      success: false,
      imported: 0,
      invalid: 0,
      errors: [String(error)],
      message: "Failed to parse CSV file",
    };
  }
}
