"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import FilterBar, { FilterState } from "@/components/ui/FilterBar";
import Pagination from "@/components/ui/Pagination";
import DebouncedInput from "@/components/ui/DebouncedInput";
import {
  Download,
  ArrowUpDown,
  ShoppingBag,
  RotateCcw,
  CheckCircle2,
  Clock,
  XCircle,
  Truck,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface OrderRow {
  order_id: string;
  order_date: string;
  marketplace: string;
  sku: string;
  product_name: string;
  category: string;
  quantity: number;
  selling_price: number;
  order_amount: number;
  order_status: string;
  final_warehouse: string;
  available_stock: number;
}

export default function OrdersPage() {
  const [filters, setFilters] = useState<FilterState>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortBy, setSortBy] = useState("order_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.marketplace) params.set("marketplace", filters.marketplace);
      if (filters.warehouse) params.set("warehouse", filters.warehouse);
      if (filters.category) params.set("category", filters.category);
      if (filters.status) params.set("status", filters.status);
      if (filters.sku) params.set("sku", filters.sku);
      if (search) params.set("search", search);

      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      params.set("sortBy", sortBy);
      params.set("sortDir", sortDir);

      const res = await fetch(`/api/orders?${params.toString()}`);
      const json = await res.json();

      setOrders(json.data || []);
      setTotal(json.total || 0);
      setTotalPages(json.totalPages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filters, search, page, pageSize, sortBy, sortDir]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
    setPage(1);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Delivered":
        return (
          <span className="badge badge-success flex items-center gap-1">
            <CheckCircle2 size={11} /> Delivered
          </span>
        );
      case "Shipped":
        return (
          <span className="badge badge-neutral text-blue-700 bg-blue-50 flex items-center gap-1">
            <Truck size={11} /> Shipped
          </span>
        );
      case "Returned":
        return (
          <span className="badge badge-critical flex items-center gap-1">
            <RotateCcw size={11} /> Returned
          </span>
        );
      case "Cancelled":
        return (
          <span className="badge badge-neutral text-slate-500 line-through flex items-center gap-1">
            <XCircle size={11} /> Cancelled
          </span>
        );
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  const getExportUrl = () => {
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.marketplace) params.set("marketplace", filters.marketplace);
    if (filters.warehouse) params.set("warehouse", filters.warehouse);
    if (filters.category) params.set("category", filters.category);
    if (filters.status) params.set("status", filters.status);
    if (filters.sku) params.set("sku", filters.sku);
    if (search) params.set("search", search);
    return `/api/exports/orders?${params.toString()}`;
  };

  return (
    <AppShell title="Orders" breadcrumb={["NexusOps", "Orders"]}>
      <div className="space-y-5">
        {/* Top Header Card */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg bg-white border border-surface-border">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Order Report</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Order transactions across marketplaces and fulfillment warehouses.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={getExportUrl()}
              download
              className="btn-secondary text-xs flex items-center gap-1.5 h-8 whitespace-nowrap"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </a>
          </div>
        </div>

        {/* Global Filter Bar */}
        <FilterBar
          filters={filters}
          onChange={(f) => { setFilters(f); setPage(1); }}
        />

        {/* Search & Counter Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-80">
            <DebouncedInput
              value={search}
              onChange={(s) => { setSearch(s); setPage(1); }}
              placeholder="Search by Order ID, SKU, or Product..."
            />
          </div>
          <div className="text-xs text-text-muted">
            Found <span className="font-semibold text-text-primary tabular-nums">{total.toLocaleString()}</span> orders
          </div>
        </div>

        {/* Orders Table Card */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th
                    onClick={() => handleSort("order_id")}
                    className="table-header cursor-pointer select-none hover:text-text-primary"
                  >
                    <div className="flex items-center gap-1">
                      <span>Order ID</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("order_date")}
                    className="table-header cursor-pointer select-none hover:text-text-primary"
                  >
                    <div className="flex items-center gap-1">
                      <span>Date</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th className="table-header">Marketplace</th>
                  <th className="table-header">SKU Ref</th>
                  <th className="table-header">Product Name</th>
                  <th className="table-header">Category</th>
                  <th
                    onClick={() => handleSort("quantity")}
                    className="table-header text-right cursor-pointer select-none hover:text-text-primary"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Qty</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th className="table-header text-right">Unit Price</th>
                  <th
                    onClick={() => handleSort("order_amount")}
                    className="table-header text-right cursor-pointer select-none hover:text-text-primary"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Amount</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Final Warehouse</th>
                  <th className="table-header text-right">Available Stock</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td colSpan={12} className="p-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-12">
                      <p className="text-sm font-medium text-text-primary">No orders match the selected filters</p>
                      <p className="text-xs text-text-muted mt-1">
                        Try resetting the filters or import orders from the Admin section.
                      </p>
                      <Link href="/admin/import" className="btn-secondary text-xs inline-flex mt-3">
                        Go to Import Manager
                      </Link>
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.order_id} className="hover:bg-slate-50 transition-colors">
                      <td className="table-cell font-mono text-xs font-semibold text-brand-blue">
                        {o.order_id}
                      </td>
                      <td className="table-cell text-xs tabular-nums text-text-muted">
                        {o.order_date}
                      </td>
                      <td className="table-cell text-xs font-medium text-text-primary">
                        {o.marketplace}
                      </td>
                      <td className="table-cell font-mono text-xs text-text-secondary">
                        {o.sku}
                      </td>
                      <td className="table-cell text-xs font-medium text-text-primary max-w-xs truncate" title={o.product_name}>
                        {o.product_name}
                      </td>
                      <td className="table-cell text-xs">
                        <span className="badge badge-neutral">{o.category}</span>
                      </td>
                      <td className="table-cell-numeric text-text-primary">
                        {o.quantity}
                      </td>
                      <td className="table-cell-numeric text-text-muted">
                        ${o.selling_price.toFixed(2)}
                      </td>
                      <td className="table-cell-numeric font-semibold text-text-primary">
                        ${o.order_amount.toFixed(2)}
                      </td>
                      <td className="table-cell text-xs">
                        {getStatusBadge(o.order_status)}
                      </td>
                      <td className="table-cell text-xs font-mono text-text-secondary">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100 font-medium text-[11px]">
                          {o.final_warehouse}
                        </span>
                      </td>
                      <td className="table-cell-numeric font-medium">
                        <span className={o.available_stock <= 25 ? "text-amber-600 font-bold" : "text-text-primary"}>
                          {o.available_stock} pcs
                        </span>
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
