"use client";

import AppShell from "@/components/layout/AppShell";
import { FileText, Package, Download, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function ReportsPage() {
  return (
    <AppShell title="Reports" breadcrumb={["NexusOps", "Reports"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="p-4 rounded-lg bg-white border border-surface-border">
          <h2 className="text-base font-semibold text-text-primary">Reports & Exports</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Download or view operational reports for orders and products.
          </p>
        </div>

        {/* Reports Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Order Report */}
          <div className="card p-6 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded bg-blue-50 text-brand-blue flex items-center justify-center mb-3">
                <FileText size={20} />
              </div>
              <h3 className="text-sm font-semibold text-text-primary">Order-wise Report</h3>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                Detailed transaction records including order ID, date, marketplace, SKU, quantity, prices, order status, warehouse allocation, and available stock.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-3">
              <Link href="/orders" className="btn-primary text-xs flex items-center gap-1.5 h-8">
                <span>View Report</span>
                <ArrowRight size={13} />
              </Link>
              <a href="/api/exports/orders" download className="btn-secondary text-xs flex items-center gap-1.5 h-8">
                <Download size={13} />
                <span>Download CSV</span>
              </a>
            </div>
          </div>

          {/* Product Report */}
          <div className="card p-6 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                <Package size={20} />
              </div>
              <h3 className="text-sm font-semibold text-text-primary">Product-wise Report</h3>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                Catalog-level performance metrics including sold quantities, gross sales amount, returned units, return amount, total stock across warehouses, and top selling marketplace.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-3">
              <Link href="/products" className="btn-primary text-xs flex items-center gap-1.5 h-8">
                <span>View Report</span>
                <ArrowRight size={13} />
              </Link>
              <a href="/api/exports/products" download className="btn-secondary text-xs flex items-center gap-1.5 h-8">
                <Download size={13} />
                <span>Download CSV</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
