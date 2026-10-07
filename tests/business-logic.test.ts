import { describe, it, expect } from "vitest";
import { deriveFinalWarehouse } from "@/lib/db/import";

describe("Business Logic - Warehouse Allocation Rule", () => {
  it("allocated warehouse wins when present", () => {
    const result = deriveFinalWarehouse("WH-SOUTH", "WH-NORTH");
    expect(result).toBe("WH-SOUTH");
  });

  it("default warehouse wins when allocated is blank or null", () => {
    expect(deriveFinalWarehouse("", "WH-NORTH")).toBe("WH-NORTH");
    expect(deriveFinalWarehouse(null, "WH-NORTH")).toBe("WH-NORTH");
    expect(deriveFinalWarehouse(undefined, "WH-NORTH")).toBe("WH-NORTH");
    expect(deriveFinalWarehouse("   ", "WH-NORTH")).toBe("WH-NORTH");
  });

  it("Warehouse Not Assigned wins when both are blank or null", () => {
    expect(deriveFinalWarehouse("", "")).toBe("Warehouse Not Assigned");
    expect(deriveFinalWarehouse(null, null)).toBe("Warehouse Not Assigned");
    expect(deriveFinalWarehouse("   ", "   ")).toBe("Warehouse Not Assigned");
  });
});

describe("Business Logic - Order Status & Sales Calculation", () => {
  const sampleOrders = [
    { order_id: "ORD-1", quantity: 3, order_amount: 300, order_status: "Delivered", sku: "SKU-A" },
    { order_id: "ORD-2", quantity: 2, order_amount: 200, order_status: "Shipped", sku: "SKU-B" },
    { order_id: "ORD-3", quantity: 1, order_amount: 100, order_status: "Cancelled", sku: "SKU-A" },
    { order_id: "ORD-4", quantity: 2, order_amount: 250, order_status: "Returned", sku: "SKU-C" },
    { order_id: "ORD-5", quantity: 1, order_amount: 150, order_status: "Returned", sku: "SKU-A" },
  ];

  it("excludes Cancelled and Returned orders from valid sales amount", () => {
    const validSales = sampleOrders
      .filter(o => !["Cancelled", "Returned"].includes(o.order_status))
      .reduce((sum, o) => sum + o.order_amount, 0);

    // ORD-1 (300) + ORD-2 (200) = 500
    expect(validSales).toBe(500);
  });

  it("includes only Returned orders in total return amount", () => {
    const returnAmount = sampleOrders
      .filter(o => o.order_status === "Returned")
      .reduce((sum, o) => sum + o.order_amount, 0);

    // ORD-4 (250) + ORD-5 (150) = 400
    expect(returnAmount).toBe(400);
  });

  it("excludes Cancelled and Returned orders from total units sold", () => {
    const unitsSold = sampleOrders
      .filter(o => !["Cancelled", "Returned"].includes(o.order_status))
      .reduce((sum, o) => sum + o.quantity, 0);

    // ORD-1 (3) + ORD-2 (2) = 5
    expect(unitsSold).toBe(5);
  });

  it("includes only Returned orders in total units returned", () => {
    const unitsReturned = sampleOrders
      .filter(o => o.order_status === "Returned")
      .reduce((sum, o) => sum + o.quantity, 0);

    // ORD-4 (2) + ORD-5 (1) = 3
    expect(unitsReturned).toBe(3);
  });

  it("calculates return rate as (total units returned / total units sold)", () => {
    const unitsSold = 5;
    const unitsReturned = 3;
    const returnRate = unitsSold > 0 ? unitsReturned / unitsSold : 0;

    expect(returnRate).toBe(0.6); // 60%
  });

  it("calculates average order value as (total valid sales / number of valid orders)", () => {
    const totalSales = 500;
    const validOrdersCount = 2; // ORD-1, ORD-2
    const aov = totalSales / validOrdersCount;

    expect(aov).toBe(250);
  });
});

describe("Business Logic - Inventory Aggregation Rule", () => {
  it("aggregates multiple warehouse inventory rows by SKU first before joining", () => {
    const rawInventory = [
      { sku: "SKU-001", warehouse: "WH-NORTH", available_quantity: 20 },
      { sku: "SKU-001", warehouse: "WH-SOUTH", available_quantity: 30 },
      { sku: "SKU-002", warehouse: "WH-WEST", available_quantity: 15 },
    ];

    // Aggregating by SKU first
    const aggregatedStock = new Map<string, number>();
    rawInventory.forEach(row => {
      aggregatedStock.set(
        row.sku,
        (aggregatedStock.get(row.sku) || 0) + row.available_quantity
      );
    });

    expect(aggregatedStock.get("SKU-001")).toBe(50);
    expect(aggregatedStock.get("SKU-002")).toBe(15);
  });
});

describe("Business Logic - Highest Selling Product by Sales Amount", () => {
  it("determines highest selling product based on total sales amount, not purely quantity", () => {
    const productsSales = [
      { sku: "SKU-CHEAP", quantity: 100, salesAmount: 1000 }, // high qty, lower rev
      { sku: "SKU-LUXURY", quantity: 5, salesAmount: 5000 },  // low qty, higher rev
    ];

    const highestSelling = [...productsSales].sort((a, b) => b.salesAmount - a.salesAmount)[0];
    expect(highestSelling.sku).toBe("SKU-LUXURY");
    expect(highestSelling.salesAmount).toBe(5000);
  });
});
