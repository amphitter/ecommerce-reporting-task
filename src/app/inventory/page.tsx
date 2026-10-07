"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import Pagination from "@/components/ui/Pagination";
import DebouncedInput from "@/components/ui/DebouncedInput";
import {
  Warehouse,
  Package,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Download,
  Building2,
  Clock,
} from "lucide-react";
import Link from "next/link";

interface InventoryItem {
  sku: string;
  product_name: string;
  category: string;
  warehouse: string;
  available_quantity: number;
  reorder_level: number;
  inventory_status: string;
  last_updated: string;
}

interface InventorySummary {
  totalSkus: number;
  totalStock: number;
  lowStockItems: number;
  outOfStockItems: number;
  warehouseCount: number;
}

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/filter-options")
      .then(res => res.json())
      .then(data => {
        if (data?.warehouses) setWarehouses(data.warehouses);
      })
      .catch(() => {});
  }, []);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (warehouse) params.set("warehouse", warehouse);
      if (status) params.set("status", status);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`/api/inventory?${params.toString()}`);
      const json = await res.json();

      setItems(json.data || []);
      setSummary(json.summary || null);
      setTotal(json.total || 0);
      setTotalPages(json.totalPages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, warehouse, status, page, pageSize]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const getStatusBadge = (statusStr: string) => {
    switch (statusStr) {
      case "IN_STOCK":
        return <span className="badge badge-success">In Stock</span>;
      case "LOW_STOCK":
        return <span className="badge badge-warning">Low Stock</span>;
      case "OUT_OF_STOCK":
        return <span className="badge badge-critical">Out of Stock</span>;
      default:
        return <span className="badge badge-neutral">{statusStr}</span>;
    }
  };

  return (
    <AppShell title="Inventory" breadcrumb={["NexusOps", "Inventory"]}>
      <div className="space-y-5">
        {/* Top Header Card */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg bg-white border border-surface-border">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Inventory Management</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Warehouse stock balances, available quantities, and reorder alerts.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/import"
              className="btn-primary text-xs flex items-center gap-1.5 h-8 whitespace-nowrap"
            >
              <span>Import Inventory</span>
            </Link>
          </div>
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="flex items-center justify-between text-xs text-text-muted mb-1">
              <span className="font-medium">Total SKUs</span>
              <Package size={15} className="text-brand-blue" />
            </div>
            <div className="text-2xl font-bold text-text-primary tabular-nums">
              {(summary?.totalSkus || 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-text-muted mt-1">Unique catalog items</div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between text-xs text-text-muted mb-1">
              <span className="font-medium">Total Stock</span>
              <Warehouse size={15} className="text-brand-blue" />
            </div>
            <div className="text-2xl font-bold text-text-primary tabular-nums">
              {(summary?.totalStock || 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-text-muted mt-1">Units across all warehouses</div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between text-xs text-text-muted mb-1">
              <span className="font-medium">Low Stock Alerts</span>
              <AlertTriangle size={15} className="text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-amber-600 tabular-nums">
              {(summary?.lowStockItems || 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-amber-600 mt-1">Items at or below reorder level</div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between text-xs text-text-muted mb-1">
              <span className="font-medium">Active Warehouses</span>
              <Building2 size={15} className="text-brand-blue" />
            </div>
            <div className="text-2xl font-bold text-text-primary tabular-nums">
              {summary?.warehouseCount || 0}
            </div>
            <div className="text-[11px] text-text-muted mt-1">Fulfillment locations</div>
          </div>
        </div>

        {/* Filters & Status Pills Bar */}
        <div className="card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => { setStatus(""); setPage(1); }}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  status === ""
                    ? "bg-brand-blue text-white"
                    : "bg-gray-100 text-text-secondary hover:bg-gray-200"
                }`}
              >
                All Records
              </button>
              <button
                onClick={() => { setStatus("IN_STOCK"); setPage(1); }}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  status === "IN_STOCK"
                    ? "bg-brand-blue text-white"
                    : "bg-gray-100 text-text-secondary hover:bg-gray-200"
                }`}
              >
                In Stock
              </button>
              <button
                onClick={() => { setStatus("LOW_STOCK"); setPage(1); }}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  status === "LOW_STOCK"
                    ? "bg-amber-600 text-white"
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                }`}
              >
                Low Stock
              </button>
              <button
                onClick={() => { setStatus("OUT_OF_STOCK"); setPage(1); }}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  status === "OUT_OF_STOCK"
                    ? "bg-critical text-white"
                    : "bg-red-50 text-critical hover:bg-red-100"
                }`}
              >
                Out of Stock
              </button>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={warehouse}
                onChange={(e) => { setWarehouse(e.target.value); setPage(1); }}
                className="input-base text-xs h-8 w-44"
              >
                <option value="">All Warehouses</option>
                {warehouses.map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
            <div className="w-full sm:w-80">
              <DebouncedInput
                value={search}
                onChange={(s) => { setSearch(s); setPage(1); }}
                placeholder="Search by SKU or Product Name..."
              />
            </div>
            <div className="text-xs text-text-muted">
              Displaying <span className="font-semibold text-text-primary tabular-nums">{total.toLocaleString()}</span> entries
            </div>
          </div>
        </div>

        {/* Inventory Table Card */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="table-header">SKU Code</th>
                  <th className="table-header">Product Name</th>
                  <th className="table-header">Category</th>
                  <th className="table-header">Warehouse Node</th>
                  <th className="table-header text-right">Available Qty</th>
                  <th className="table-header text-right">Reorder Level</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td colSpan={8} className="p-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12">
                      <p className="text-sm font-medium text-text-primary">No inventory records found</p>
                      <p className="text-xs text-text-muted mt-1">
                        Try resetting filters or import inventory.csv in the Admin section.
                      </p>
                      <Link href="/admin/import" className="btn-secondary text-xs inline-flex mt-3">
                        Go to Import Manager
                      </Link>
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={`${item.sku}-${item.warehouse}-${idx}`} className="hover:bg-slate-50 transition-colors">
                      <td className="table-cell font-mono text-xs font-semibold text-brand-blue">
                        {item.sku}
                      </td>
                      <td className="table-cell text-xs font-medium text-text-primary max-w-xs truncate" title={item.product_name}>
                        {item.product_name}
                      </td>
                      <td className="table-cell text-xs">
                        <span className="badge badge-neutral">{item.category}</span>
                      </td>
                      <td className="table-cell text-xs font-mono text-text-secondary">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100 font-medium text-[11px]">
                          {item.warehouse}
                        </span>
                      </td>
                      <td className="table-cell-numeric font-semibold">
                        <span className={item.available_quantity === 0 ? "text-critical" : item.available_quantity <= item.reorder_level ? "text-amber-600" : "text-text-primary"}>
                          {item.available_quantity} pcs
                        </span>
                      </td>
                      <td className="table-cell-numeric text-text-muted">
                        {item.reorder_level} pcs
                      </td>
                      <td className="table-cell text-xs">
                        {getStatusBadge(item.inventory_status)}
                      </td>
                      <td className="table-cell text-xs text-text-muted tabular-nums">
                        {item.last_updated}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && total > 0 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              total={total}
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
