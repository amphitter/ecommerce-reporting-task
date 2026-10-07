"use client";

import AppShell from "@/components/layout/AppShell";
import {
  FileText,
  Package,
  Warehouse,
  Download,
  ArrowRight,
  Calculator,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

export default function ReportsPage() {
  return (
    <AppShell title="Operational Reports & Analytical Exports" breadcrumb={["NexusOps", "Enterprise Portal", "Reports"]}>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="p-4 rounded-lg bg-white border border-surface-border">
          <h2 className="text-base font-bold text-text-primary">Executive & Operational Reporting Suite</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Server-generated, filtered transactional exports and catalog performance ledgers.
          </p>
        </div>

        {/* 2 Primary Deliverable Reports Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Order-wise Report Card */}
          <div className="card p-6 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-brand-blue flex items-center justify-center mb-4">
                <FileText size={20} />
              </div>
              <h3 className="text-base font-bold text-text-primary">Order-wise Report</h3>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                Granular multi-marketplace order dispatch ledger. Displays order ID, date, marketplace, SKU, product name, category, quantity, unit price, order amount, status, final warehouse, and available stock.
              </p>
              <div className="mt-4 py-2 px-3 rounded bg-slate-50 border border-slate-200 text-[11px] text-text-secondary">
                <span className="font-semibold text-text-primary">Business Rule:</span> Stocks are joined from pre-aggregated SKU inventory to eliminate duplicated counts.
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-3">
              <Link href="/orders" className="btn-primary text-xs flex items-center gap-1.5 h-8">
                <span>Open Orders Report</span>
                <ArrowRight size={14} />
              </Link>
              <a href="/api/exports/orders" download className="btn-secondary text-xs flex items-center gap-1.5 h-8">
                <Download size={14} />
                <span>Download Orders CSV</span>
              </a>
            </div>
          </div>

          {/* Product-wise Report Card */}
          <div className="card p-6 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                <Package size={20} />
              </div>
              <h3 className="text-base font-bold text-text-primary">Product-wise Report</h3>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                Comprehensive SKU performance ledger. Displays SKU, product name, category, sold quantity, sales amount, returned quantity, return amount, total stock across warehouses, warehouse count, and top marketplace.
              </p>
              <div className="mt-4 py-2 px-3 rounded bg-slate-50 border border-slate-200 text-[11px] text-text-secondary">
                <span className="font-semibold text-text-primary">Business Rule:</span> Inventory is grouped by SKU prior to joining orders to guarantee accurate stock totals.
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-3">
              <Link href="/products" className="btn-primary text-xs flex items-center gap-1.5 h-8">
                <span>Open Products Report</span>
                <ArrowRight size={14} />
              </Link>
              <a href="/api/exports/products" download className="btn-secondary text-xs flex items-center gap-1.5 h-8">
                <Download size={14} />
                <span>Download Products CSV</span>
              </a>
            </div>
          </div>
        </div>

        {/* Business Logic Documentation Card */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calculator size={18} className="text-brand-blue" />
            <h3 className="text-sm font-bold text-text-primary">Reporting Business Logic & KPI Formulas</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="p-3 rounded border border-surface-border bg-slate-50/50">
              <span className="font-semibold text-text-primary block mb-1">Valid Sales Amount</span>
              <code className="text-brand-blue font-mono text-[11px]">SUM(order_amount)</code>
              <p className="text-text-muted text-[11px] mt-1">
                Where order_status is NOT Cancelled or Returned.
              </p>
            </div>

            <div className="p-3 rounded border border-surface-border bg-slate-50/50">
              <span className="font-semibold text-text-primary block mb-1">Total Return Amount</span>
              <code className="text-critical font-mono text-[11px]">SUM(order_amount)</code>
              <p className="text-text-muted text-[11px] mt-1">
                Where order_status = &apos;Returned&apos;.
              </p>
            </div>

            <div className="p-3 rounded border border-surface-border bg-slate-50/50">
              <span className="font-semibold text-text-primary block mb-1">Return Rate</span>
              <code className="text-text-secondary font-mono text-[11px]">total_units_returned / total_units_sold</code>
              <p className="text-text-muted text-[11px] mt-1">
                Evaluated against net dispatched sales volume.
              </p>
            </div>

            <div className="p-3 rounded border border-surface-border bg-slate-50/50">
              <span className="font-semibold text-text-primary block mb-1">Average Order Value (AOV)</span>
              <code className="text-text-secondary font-mono text-[11px]">total_sales / valid_orders_count</code>
              <p className="text-text-muted text-[11px] mt-1">
                Calculated purely across non-cancelled, non-returned transactions.
              </p>
            </div>

            <div className="p-3 rounded border border-surface-border bg-slate-50/50">
              <span className="font-semibold text-text-primary block mb-1">Warehouse Allocation Rule</span>
              <p className="text-text-secondary text-[11px] leading-relaxed">
                If allocated_warehouse present &rarr; use it. If blank &rarr; default_warehouse. If both blank &rarr; &apos;Warehouse Not Assigned&apos;.
              </p>
            </div>

            <div className="p-3 rounded border border-surface-border bg-slate-50/50">
              <span className="font-semibold text-text-primary block mb-1">Top Selling Product</span>
              <p className="text-text-secondary text-[11px] leading-relaxed">
                Ranked by gross valid sales amount contribution (not purely quantity).
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
