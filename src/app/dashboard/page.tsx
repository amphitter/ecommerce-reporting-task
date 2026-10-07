"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import KpiCard from "@/components/ui/KpiCard";
import FilterBar, { FilterState } from "@/components/ui/FilterBar";
import SalesTrendChart from "@/components/charts/SalesTrendChart";
import WarehouseSalesDonut from "@/components/charts/WarehouseSalesDonut";
import {
  DollarSign,
  TrendingDown,
  ShoppingBag,
  RotateCcw,
  Percent,
  Receipt,
  Trophy,
  AlertTriangle,
  ArrowDownRight,
  PackageCheck,
  Zap,
  Download,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

interface DashboardData {
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

export default function DashboardPage() {
  const [filters, setFilters] = useState<FilterState>({});
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.marketplace) params.set("marketplace", filters.marketplace);
      if (filters.warehouse) params.set("warehouse", filters.warehouse);
      if (filters.category) params.set("category", filters.category);
      if (filters.status) params.set("status", filters.status);
      if (filters.sku) params.set("sku", filters.sku);

      const res = await fetch(`/api/dashboard?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load dashboard data");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setError("Unable to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const isEmpty = !loading && (!data || (data.kpis.totalSales === 0 && data.kpis.totalUnitsSold === 0));

  return (
    <AppShell title="Dashboard" breadcrumb={["NexusOps", "Dashboard"]}>
      <div className="space-y-6">
        {/* Header Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-white border border-surface-border">
          <div>
            <h2 className="text-base font-semibold text-text-primary">E-commerce Sales & Inventory</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Consolidated sales performance, returns, and inventory distribution.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/exports/orders"
              download
              className="btn-secondary text-xs flex items-center gap-1.5 h-8 whitespace-nowrap"
            >
              <Download size={14} />
              <span>Export Orders</span>
            </a>
            <Link
              href="/admin/import"
              className="btn-primary text-xs flex items-center gap-1.5 h-8 whitespace-nowrap"
            >
              <span>Import Data</span>
            </Link>
          </div>
        </div>

        {/* Global Filter Bar */}
        <FilterBar filters={filters} onChange={setFilters} />

        {/* Empty State */}
        {isEmpty && (
          <div className="card p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto my-6">
            <h3 className="text-sm font-semibold text-text-primary">
              {Object.values(filters).some(v => v !== undefined && v !== "")
                ? "No data matches your active filters"
                : "No data found"}
            </h3>
            <p className="text-xs text-text-muted mt-1 mb-4">
              {Object.values(filters).some(v => v !== undefined && v !== "")
                ? "Try clearing or adjusting your date range, marketplace, or warehouse filters."
                : "Import product, order, and inventory CSV files to populate reporting metrics."}
            </p>
            {Object.values(filters).some(v => v !== undefined && v !== "") ? (
              <button
                type="button"
                onClick={() => setFilters({})}
                className="btn-secondary text-xs inline-flex items-center gap-1.5 h-8"
              >
                <span>Reset All Filters</span>
              </button>
            ) : (
              <Link
                href="/admin/import"
                className="btn-primary text-xs inline-flex items-center gap-1.5 h-8"
              >
                <span>Go to Import</span>
                <ArrowRight size={13} />
              </Link>
            )}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="card p-4 bg-red-50 border-red-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2 text-critical font-medium">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
            <button onClick={fetchDashboard} className="btn-secondary text-xs h-7">
              Retry
            </button>
          </div>
        )}

        {/* 12 KPI Cards Grid */}
        {!isEmpty && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Total Sales Amount */}
              <KpiCard
                label="Total Sales Amount"
                value={`$${(data?.kpis.totalSales || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                subtext="Valid sales (Cancelled & Returned excluded)"
                icon={DollarSign}
                accent="success"
                loading={loading}
              />

              {/* 2. Total Return Amount */}
              <KpiCard
                label="Total Return Amount"
                value={`$${(data?.kpis.totalReturnAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                subtext="Total amount from returned orders"
                icon={TrendingDown}
                accent="critical"
                loading={loading}
              />

              {/* 3. Total Units Sold */}
              <KpiCard
                label="Total Units Sold"
                value={`${(data?.kpis.totalUnitsSold || 0).toLocaleString()}`}
                subtext="Valid orders unit volume"
                icon={ShoppingBag}
                loading={loading}
              />

              {/* 4. Total Units Returned */}
              <KpiCard
                label="Total Units Returned"
                value={`${(data?.kpis.totalUnitsReturned || 0).toLocaleString()}`}
                subtext="Returned quantity"
                icon={RotateCcw}
                accent="critical"
                loading={loading}
              />

              {/* 5. Return Rate */}
              <KpiCard
                label="Return Rate"
                value={`${((data?.kpis.returnRate || 0) * 100).toFixed(2)}%`}
                subtext="Units returned / units sold"
                icon={Percent}
                accent={(data?.kpis.returnRate || 0) > 0.05 ? "critical" : "default"}
                loading={loading}
              />

              {/* 6. Average Order Value */}
              <KpiCard
                label="Average Order Value"
                value={`$${(data?.kpis.averageOrderValue || 0).toFixed(2)}`}
                subtext="Sales amount / valid orders"
                icon={Receipt}
                loading={loading}
              />

              {/* 7. Highest Selling Product (By Amount) */}
              <KpiCard
                label="Highest-Selling Product"
                value={
                  <div className="truncate text-sm font-semibold" title={data?.kpis.highestSellingProduct?.product_name || "None"}>
                    {data?.kpis.highestSellingProduct?.product_name || "None"}
                  </div>
                }
                subtext={
                  data?.kpis.highestSellingProduct ? (
                    <span className="text-text-secondary">
                      ${data.kpis.highestSellingProduct.sales_amount.toLocaleString()} &bull; Determined by sales amount
                    </span>
                  ) : "Determined by sales amount"
                }
                icon={Trophy}
                accent="success"
                loading={loading}
              />

              {/* 8. Highest Return Product by Amount */}
              <KpiCard
                label="Highest Return Product (Amount)"
                value={
                  <div className="truncate text-sm font-semibold text-critical" title={data?.kpis.highestReturnProductByAmount?.product_name || "None"}>
                    {data?.kpis.highestReturnProductByAmount?.product_name || "None"}
                  </div>
                }
                subtext={
                  data?.kpis.highestReturnProductByAmount
                    ? `$${data.kpis.highestReturnProductByAmount.return_amount.toLocaleString()} returned`
                    : "Maximum returned order amount"
                }
                icon={AlertTriangle}
                accent="critical"
                loading={loading}
              />

              {/* 9. Highest Return Product by Quantity */}
              <KpiCard
                label="Highest Return Product (Quantity)"
                value={
                  <div className="truncate text-sm font-semibold text-critical" title={data?.kpis.highestReturnProductByQuantity?.product_name || "None"}>
                    {data?.kpis.highestReturnProductByQuantity?.product_name || "None"}
                  </div>
                }
                subtext={
                  data?.kpis.highestReturnProductByQuantity
                    ? `${data.kpis.highestReturnProductByQuantity.return_units} units returned`
                    : "Maximum returned quantity"
                }
                icon={RotateCcw}
                accent="critical"
                loading={loading}
              />

              {/* 10. Lowest Stock Product */}
              <KpiCard
                label="Lowest-Stock Product"
                value={
                  <div className="truncate text-sm font-semibold text-amber-600" title={data?.kpis.lowestStockProduct?.product_name || "None"}>
                    {data?.kpis.lowestStockProduct?.product_name || "None"}
                  </div>
                }
                subtext={
                  data?.kpis.lowestStockProduct
                    ? `${data.kpis.lowestStockProduct.total_stock} units across warehouses`
                    : "Min total available quantity"
                }
                icon={ArrowDownRight}
                accent="warning"
                loading={loading}
              />

              {/* 11. Highest Stock Product */}
              <KpiCard
                label="Highest-Stock Product"
                value={
                  <div className="truncate text-sm font-semibold" title={data?.kpis.highestStockProduct?.product_name || "None"}>
                    {data?.kpis.highestStockProduct?.product_name || "None"}
                  </div>
                }
                subtext={
                  data?.kpis.highestStockProduct
                    ? `${data.kpis.highestStockProduct.total_stock.toLocaleString()} units across warehouses`
                    : "Max total available quantity"
                }
                icon={PackageCheck}
                loading={loading}
              />

              {/* 12. Average Consumption Per Day */}
              <KpiCard
                label="Average Consumption Per Day"
                value={`${(data?.kpis.averageConsumptionPerDay || 0).toLocaleString()}`}
                subtext="Units sold / days in date range"
                icon={Zap}
                loading={loading}
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SalesTrendChart data={data?.salesTrend || []} loading={loading} />
              <WarehouseSalesDonut data={data?.warehouseSales || []} loading={loading} />
            </div>

            {/* Top Products Table */}
            <div className="card">
              <div className="p-4 border-b border-surface-border flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-text-primary text-sm">Top Selling Products</h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Ranked by total sales amount
                  </p>
                </div>
                <Link
                  href="/products"
                  className="btn-secondary text-xs flex items-center gap-1 h-7"
                >
                  <span>View All</span>
                  <ArrowRight size={12} />
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="table-header w-12 text-center">#</th>
                      <th className="table-header">Product</th>
                      <th className="table-header">SKU</th>
                      <th className="table-header">Category</th>
                      <th className="table-header text-right">Units Sold</th>
                      <th className="table-header text-right">Sales Amount</th>
                      <th className="table-header text-right">Return Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.topProducts || []).map((prod, idx) => (
                      <tr key={prod.sku} className="hover:bg-surface-hover transition-colors">
                        <td className="table-cell text-center text-text-muted font-medium text-xs">
                          {idx + 1}
                        </td>
                        <td className="table-cell font-medium text-text-primary text-xs">
                          {prod.product_name}
                        </td>
                        <td className="table-cell font-mono text-xs text-text-secondary">
                          {prod.sku}
                        </td>
                        <td className="table-cell text-xs text-text-secondary">
                          <span className="badge badge-neutral">{prod.category}</span>
                        </td>
                        <td className="table-cell-numeric text-text-primary text-xs">
                          {prod.units.toLocaleString()}
                        </td>
                        <td className="table-cell-numeric font-medium text-text-primary text-xs">
                          ${prod.sales.toLocaleString()}
                        </td>
                        <td className="table-cell-numeric text-critical text-xs">
                          ${prod.returns.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {(!data?.topProducts || data.topProducts.length === 0) && (
                      <tr>
                        <td colSpan={7} className="text-center py-6 text-xs text-text-muted">
                          No product records available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
