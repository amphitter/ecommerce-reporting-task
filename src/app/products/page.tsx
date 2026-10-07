"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import Pagination from "@/components/ui/Pagination";
import DebouncedInput from "@/components/ui/DebouncedInput";
import { Download, Package, Store, Warehouse, TrendingUp, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface ProductRow {
  sku: string;
  product_name: string;
  category: string;
  sold_quantity: number;
  sales_amount: number;
  returned_quantity: number;
  return_amount: number;
  total_stock: number;
  warehouse_count: number;
  top_marketplace: string;
}

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [categories, setCategories] = useState<string[]>([]);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/filter-options")
      .then(res => res.json())
      .then(data => {
        if (data?.categories) setCategories(data.categories);
      })
      .catch(() => {});
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (category) params.set("category", category);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`/api/products?${params.toString()}`);
      const json = await res.json();

      setProducts(json.data || []);
      setTotal(json.total || 0);
      setTotalPages(json.totalPages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, category, page, pageSize]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const getExportUrl = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    return `/api/exports/products?${params.toString()}`;
  };

  return (
    <AppShell title="Products" breadcrumb={["NexusOps", "Products"]}>
      <div className="space-y-5">
        {/* Top Header Card */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg bg-white border border-surface-border">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Product Performance</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Sales volume, return amounts, total stock, and top marketplace per SKU.
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

        {/* Filter & Search Bar */}
        <div className="card p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="w-full sm:w-72">
              <DebouncedInput
                value={search}
                onChange={(s) => { setSearch(s); setPage(1); }}
                placeholder="Search by SKU or Product Name..."
              />
            </div>
            <div className="min-w-[150px]">
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                className="input-base text-xs h-8"
              >
                <option value="">All Categories</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {(search || category) && (
              <button
                onClick={() => { setSearch(""); setCategory(""); setPage(1); }}
                className="text-xs text-critical hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
          <div className="text-xs text-text-muted">
            Total SKUs: <span className="font-semibold text-text-primary tabular-nums">{total.toLocaleString()}</span>
          </div>
        </div>

        {/* Products Table Card */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="table-header">SKU</th>
                  <th className="table-header">Product Name</th>
                  <th className="table-header">Category</th>
                  <th className="table-header text-right">Sold Qty</th>
                  <th className="table-header text-right">Sales Amount</th>
                  <th className="table-header text-right">Returned Qty</th>
                  <th className="table-header text-right">Return Amount</th>
                  <th className="table-header text-right">Total Stock</th>
                  <th className="table-header text-center">Hubs</th>
                  <th className="table-header">Top Marketplace</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td colSpan={10} className="p-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12">
                      <p className="text-sm font-medium text-text-primary">No products found</p>
                      <p className="text-xs text-text-muted mt-1">
                        Try resetting your search or import products from the Admin section.
                      </p>
                      <Link href="/admin/import" className="btn-secondary text-xs inline-flex mt-3">
                        Go to Import Manager
                      </Link>
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.sku} className="hover:bg-slate-50 transition-colors">
                      <td className="table-cell font-mono text-xs font-semibold text-brand-blue">
                        {p.sku}
                      </td>
                      <td className="table-cell text-xs font-medium text-text-primary max-w-xs truncate" title={p.product_name}>
                        {p.product_name}
                      </td>
                      <td className="table-cell text-xs">
                        <span className="badge badge-neutral">{p.category}</span>
                      </td>
                      <td className="table-cell-numeric text-text-primary">
                        {p.sold_quantity.toLocaleString()} pcs
                      </td>
                      <td className="table-cell-numeric font-semibold text-text-primary">
                        ${p.sales_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="table-cell-numeric text-critical">
                        {p.returned_quantity} pcs
                      </td>
                      <td className="table-cell-numeric text-critical font-medium">
                        ${p.return_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="table-cell-numeric font-semibold">
                        <span className={p.total_stock === 0 ? "text-critical" : p.total_stock <= 30 ? "text-amber-600" : "text-text-primary"}>
                          {p.total_stock.toLocaleString()} pcs
                        </span>
                      </td>
                      <td className="table-cell text-center text-xs text-text-muted">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100 font-medium">
                          {p.warehouse_count}
                        </span>
                      </td>
                      <td className="table-cell text-xs font-medium text-text-primary">
                        {p.top_marketplace !== "-" ? (
                          <span className="badge badge-neutral text-blue-700 bg-blue-50 font-medium">
                            {p.top_marketplace}
                          </span>
                        ) : (
                          <span className="text-text-muted">-</span>
                        )}
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
