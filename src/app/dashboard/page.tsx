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
  Database,
  ArrowRight,
  Flame,
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
      setError("Unable to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const isEmpty = !loading && (!data || data.kpis.totalSales === 0 && data.kpis.totalUnitsSold === 0);

  return (
    <AppShell title="E-commerce Sales & Inventory Dashboard" breadcrumb={["NexusOps", "Enterprise Portal", "Dashboard"]}>
      <div className="space-y-6">
        {/* Top Operational Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg bg-white border border-surface-border">
          <div>
            <div className="flex items-center gap-2 text-[11px] text-text-muted font-mono uppercase tracking-wider mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Global Fulfillment Nexus &bull; Live Telemetry</span>
            </div>
            <h2 className="text-base font-bold text-text-primary">Operational Pulse & Analytics</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Real-time velocity, returns anomalies, multi-warehouse run-rates, and stock allocations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/import"
              className="btn-secondary text-xs flex items-center gap-1.5 h-8 whitespace-nowrap"
            >
              <Database size={14} className="text-brand-blue" />
              <span>Import Datasets</span>
            </Link>
            <a
              href="/api/exports/orders"
              className="btn-primary text-xs flex items-center gap-1.5 h-8 whitespace-nowrap"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </a>
          </div>
        </div>

        {/* Global Filter Bar */}
        <FilterBar filters={filters} onChange={setFilters} />

        {/* Empty State when no CSV imported */}
        {isEmpty && (
          <div className="card p-10 text-center flex flex-col items-center justify-center max-w-xl mx-auto my-8">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-brand-blue flex items-center justify-center mb-3">
              <Database size={24} />
            </div>
            <h3 className="text-base font-semibold text-text-primary">No Data Records Found</h3>
            <p className="text-xs text-text-muted max-w-md mt-1 mb-5">
              The platform database is currently fresh and clean. To view real-time sales, return analytics, stock levels, and warehouse allocations, please import the provided CSV files.
            </p>
            <Link
              href="/admin/import"
              className="btn-primary text-xs flex items-center gap-2 h-9"
            >
              <span>Go to CSV Import Manager</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="card p-5 bg-red-50 border-red-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2 text-critical font-medium">
              <AlertTriangle size={18} />
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
                subtext={`${data?.kpis.totalUnitsReturned || 0} returned orders`}
                icon={TrendingDown}
                accent="critical"
                loading={loading}
              />

              {/* 3. Total Units Sold */}
              <KpiCard
                label="Total Units Sold"
                value={`${(data?.kpis.totalUnitsSold || 0).toLocaleString()} pcs`}
                subtext="Net units dispatched"
                icon={ShoppingBag}
                loading={loading}
              />

              {/* 4. Total Units Returned */}
              <KpiCard
                label="Total Units Returned"
                value={`${(data?.kpis.totalUnitsReturned || 0).toLocaleString()} pcs`}
                subtext="Defects & customer returns"
                icon={RotateCcw}
                accent="critical"
                loading={loading}
              />

              {/* 5. Return Rate */}
              <KpiCard
                label="Return Rate"
                value={`${((data?.kpis.returnRate || 0) * 100).toFixed(2)}%`}
                subtext="Total units returned / Total units sold"
                icon={Percent}
                accent={(data?.kpis.returnRate || 0) > 0.05 ? "critical" : "default"}
                loading={loading}
              />

              {/* 6. Average Order Value */}
              <KpiCard
                label="Average Order Value"
                value={`$${(data?.kpis.averageOrderValue || 0).toFixed(2)}`}
                subtext="Total valid sales / Valid orders"
                icon={Receipt}
                loading={loading}
              />

              {/* 7. Highest Selling Product (By Amount) */}
              <KpiCard
                label="Top Revenue Champion"
                value={
                  <div className="truncate text-base font-bold" title={data?.kpis.highestSellingProduct?.product_name || "None"}>
                    {data?.kpis.highestSellingProduct?.product_name || "None"}
                  </div>
                }
                subtext={
                  data?.kpis.highestSellingProduct ? (
                    <span className="text-success font-medium">
                      ${data.kpis.highestSellingProduct.sales_amount.toLocaleString()} ({data.kpis.highestSellingProduct.units_sold} units) &bull; By Amount
                    </span>
                  ) : "Determined by sales amount"
                }
                icon={Trophy}
                accent="success"
                loading={loading}
              />

              {/* 8. Highest Return Product by Amount */}
              <KpiCard
                label="Top Return Loss ($)"
                value={
                  <div className="truncate text-base font-bold text-critical" title={data?.kpis.highestReturnProductByAmount?.product_name || "None"}>
                    {data?.kpis.highestReturnProductByAmount?.product_name || "None"}
                  </div>
                }
                subtext={
                  data?.kpis.highestReturnProductByAmount
                    ? `-$${data.kpis.highestReturnProductByAmount.return_amount.toLocaleString()} return loss`
                    : "Max returned amount"
                }
                icon={AlertTriangle}
                accent="critical"
                loading={loading}
              />

              {/* 9. Highest Return Product by Quantity */}
              <KpiCard
                label="Top Return Qty"
                value={
                  <div className="truncate text-base font-bold text-critical" title={data?.kpis.highestReturnProductByQuantity?.product_name || "None"}>
                    {data?.kpis.highestReturnProductByQuantity?.product_name || "None"}
                  </div>
                }
                subtext={
                  data?.kpis.highestReturnProductByQuantity
                    ? `${data.kpis.highestReturnProductByQuantity.return_units} units returned`
                    : "Max returned qty"
                }
                icon={RotateCcw}
                accent="critical"
                loading={loading}
              />

              {/* 10. Lowest Stock Product */}
              <KpiCard
                label="Stockout Alert (Lowest Stock)"
                value={
                  <div className="truncate text-base font-bold text-amber-600" title={data?.kpis.lowestStockProduct?.product_name || "None"}>
                    {data?.kpis.lowestStockProduct?.product_name || "None"}
                  </div>
                }
                subtext={
                  data?.kpis.lowestStockProduct
                    ? `${data.kpis.lowestStockProduct.total_stock} units across warehouses`
                    : "Min available quantity"
                }
                icon={ArrowDownRight}
                accent="warning"
                loading={loading}
              />

              {/* 11. Highest Stock Product */}
              <KpiCard
                label="Highest Stock Buffer"
                value={
                  <div className="truncate text-base font-bold" title={data?.kpis.highestStockProduct?.product_name || "None"}>
                    {data?.kpis.highestStockProduct?.product_name || "None"}
                  </div>
                }
                subtext={
                  data?.kpis.highestStockProduct
                    ? `${data.kpis.highestStockProduct.total_stock.toLocaleString()} units available`
                    : "Max available quantity"
                }
                icon={PackageCheck}
                loading={loading}
              />

              {/* 12. Average Consumption Per Day */}
              <KpiCard
                label="Avg Consumption Velocity"
                value={`${(data?.kpis.averageConsumptionPerDay || 0).toLocaleString()} / day`}
                subtext="Total units sold / date range days"
                icon={Zap}
                loading={loading}
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SalesTrendChart data={data?.salesTrend || []} loading={loading} />
              <WarehouseSalesDonut data={data?.warehouseSales || []} loading={loading} />
            </div>

            {/* Top Performing SKUs Table */}
            <div className="card">
              <div className="p-5 border-b border-surface-border flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-text-primary text-sm flex items-center gap-1.5">
                    <Flame size={16} className="text-brand-blue" />
                    <span>Top Performing SKUs & Velocity Ledger</span>
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Top 5 products ranked by gross valid sales amount contribution
                  </p>
                </div>
                <Link
                  href="/products"
                  className="btn-secondary text-xs flex items-center gap-1 h-7"
                >
                  <span>View All Products</span>
                  <ArrowRight size={12} />
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="table-header w-12 text-center">Rank</th>
                      <th className="table-header">Product Name</th>
                      <th className="table-header">SKU Code</th>
                      <th className="table-header">Category</th>
                      <th className="table-header text-right">Units Sold</th>
                      <th className="table-header text-right">Gross Sales ($)</th>
                      <th className="table-header text-right">Return ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.topProducts || []).map((prod, idx) => (
                      <tr key={prod.sku} className="hover:bg-slate-50 transition-colors">
                        <td className="table-cell text-center font-bold text-text-muted">
                          #{idx + 1}
                        </td>
                        <td className="table-cell font-medium text-text-primary">
                          {prod.product_name}
                        </td>
                        <td className="table-cell font-mono text-xs text-brand-blue">
                          {prod.sku}
                        </td>
                        <td className="table-cell text-xs text-text-secondary">
                          <span className="badge badge-neutral">{prod.category}</span>
                        </td>
                        <td className="table-cell-numeric text-text-primary">
                          {prod.units.toLocaleString()} pcs
                        </td>
                        <td className="table-cell-numeric font-semibold text-text-primary">
                          ${prod.sales.toLocaleString()}
                        </td>
                        <td className="table-cell-numeric text-critical font-medium">
                          ${prod.returns.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {(!data?.topProducts || data.topProducts.length === 0) && (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-xs text-text-muted">
                          No product sales records available
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
