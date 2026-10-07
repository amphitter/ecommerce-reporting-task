"use client";

import { useState, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  UploadCloud,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  Package,
  ShoppingCart,
  Warehouse,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  Database,
  ExternalLink,
} from "lucide-react";

type ImportType = "products" | "orders" | "inventory";

interface ImportCounts {
  products: number;
  orders: number;
  inventory: number;
}

interface BackendStatus {
  isSupabase: boolean;
  supabaseReady: boolean;
}

export default function ImportPage() {
  const [counts, setCounts] = useState<ImportCounts>({ products: 0, orders: 0, inventory: 0 });
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({ isSupabase: false, supabaseReady: false });
  const [selectedType, setSelectedType] = useState<ImportType>("products");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [migrationSql, setMigrationSql] = useState<string>("");
  const [result, setResult] = useState<{
    success: boolean;
    imported: number;
    invalid: number;
    errors: string[];
    message: string;
  } | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const fetchCounts = async () => {
    try {
      const res = await fetch("/api/import");
      const data = await res.json();
      if (data.counts) {
        setCounts(data.counts);
      }
      setBackendStatus({
        isSupabase: Boolean(data.isSupabase),
        supabaseReady: Boolean(data.supabaseReady),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSql = async () => {
    try {
      const res = await fetch("/api/schema");
      const data = await res.json();
      if (data.sql) {
        setMigrationSql(data.sql);
      }
    } catch (e) {
      console.error("Failed to load schema SQL", e);
    }
  };

  useEffect(() => {
    fetchCounts();
    fetchSql();
  }, []);

  const handleCopyMigration = async () => {
    try {
      if (!migrationSql) {
        const res = await fetch("/api/schema");
        const data = await res.json();
        await navigator.clipboard.writeText(data.sql || "");
      } else {
        await navigator.clipboard.writeText(migrationSql);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", selectedType);

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResult(data);
      if (data.counts) setCounts(data.counts);
      setFile(null);
    } catch {
      setResult({
        success: false,
        imported: 0,
        invalid: 0,
        errors: ["Network or server error during upload"],
        message: "Upload failed",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearDatabase = async () => {
    if (!confirm("Are you sure you want to clear all imported records?")) return;
    setIsClearing(true);
    try {
      await fetch("/api/import", { method: "DELETE" });
      setResult({
        success: true,
        imported: 0,
        invalid: 0,
        errors: [],
        message: "Database records cleared",
      });
      await fetchCounts();
    } catch {
      alert("Failed to clear database");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <AppShell title="Data Import" breadcrumb={["NexusOps", "Settings", "Data Import"]}>
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-white border border-surface-border">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-text-primary">CSV Import Manager</h2>
              {backendStatus.isSupabase && backendStatus.supabaseReady && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Database size={10} />
                  Supabase Connected
                </span>
              )}
              {backendStatus.isSupabase && !backendStatus.supabaseReady && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  <Database size={10} />
                  Local Session Mode
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Upload product catalogs, orders, and inventory files to populate the database.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchCounts}
              className="btn-secondary text-xs flex items-center gap-1.5 h-8"
              title="Refresh counts"
            >
              <RefreshCw size={13} />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleClearDatabase}
              disabled={isClearing}
              className="btn-destructive text-xs flex items-center gap-1.5 h-8"
            >
              <Trash2 size={13} />
              <span>Clear Data</span>
            </button>
          </div>
        </div>

        {/* Supabase Schema Action Banner (Shown when credentials exist but tables need to be created) */}
        {backendStatus.isSupabase && !backendStatus.supabaseReady && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="font-semibold flex items-center gap-1.5 text-amber-800">
                  <AlertCircle size={15} />
                  <span>Supabase Integration Action Required</span>
                </div>
                <p className="text-amber-700 text-[12px] leading-relaxed">
                  Supabase credentials are authenticated in your deployment, but database tables (<code>products</code>, <code>orders</code>, <code>inventory</code>, <code>warehouses</code>) are not yet initialized in your Supabase SQL editor.
                </p>
                <p className="text-amber-700 text-[12px] leading-relaxed">
                  The platform is safely operating in fallback local container storage. To activate permanent cloud persistence across Vercel lambdas, run the 1-click SQL migration below in your Supabase project.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyMigration}
                  className="px-3 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded font-medium text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? "Copied SQL Script!" : "Copy SQL Migration"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSql(!showSql)}
                  className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-800 rounded font-medium text-xs transition-colors"
                >
                  {showSql ? "Hide SQL" : "View SQL"}
                </button>
              </div>
            </div>

            {showSql && (
              <div className="mt-4 pt-3 border-t border-amber-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-amber-800 text-[11px]">Migration Script:</span>
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-800 hover:underline text-[11px] flex items-center gap-1"
                  >
                    <span>Open Supabase Dashboard</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
                <pre className="bg-white p-3 rounded border border-amber-200 text-[11px] font-mono text-text-primary max-h-60 overflow-y-auto whitespace-pre">
                  {migrationSql || "Loading schema SQL..."}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Current Database Records */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-4">
            <div className="flex items-center justify-between text-xs text-text-muted mb-1">
              <span className="font-medium">Products</span>
              <Package size={15} className="text-brand-blue" />
            </div>
            <div className="text-2xl font-bold text-text-primary tabular-nums">
              {counts.products.toLocaleString()}
            </div>
            <div className="text-[11px] text-text-muted mt-0.5">Total records in database</div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between text-xs text-text-muted mb-1">
              <span className="font-medium">Orders</span>
              <ShoppingCart size={15} className="text-brand-blue" />
            </div>
            <div className="text-2xl font-bold text-text-primary tabular-nums">
              {counts.orders.toLocaleString()}
            </div>
            <div className="text-[11px] text-text-muted mt-0.5">Total records in database</div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between text-xs text-text-muted mb-1">
              <span className="font-medium">Inventory</span>
              <Warehouse size={15} className="text-brand-blue" />
            </div>
            <div className="text-2xl font-bold text-text-primary tabular-nums">
              {counts.inventory.toLocaleString()}
            </div>
            <div className="text-[11px] text-text-muted mt-0.5">Total records in database</div>
          </div>
        </div>

        {/* Upload Form Card */}
        <div className="card p-6">
          <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-3">
            Select Dataset Type
          </h3>

          {/* Type Selector Tabs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <button
              type="button"
              onClick={() => { setSelectedType("products"); setResult(null); }}
              className={`p-3 rounded border text-left transition-colors ${
                selectedType === "products"
                  ? "border-brand-blue bg-blue-50/40"
                  : "border-surface-border hover:bg-gray-50"
              }`}
            >
              <div className="text-xs font-semibold text-text-primary mb-1">Products CSV</div>
              <p className="text-[11px] text-text-muted">
                Columns: product_id, sku, product_name, category, brand, selling_price, cost_price, default_warehouse, active
              </p>
            </button>

            <button
              type="button"
              onClick={() => { setSelectedType("orders"); setResult(null); }}
              className={`p-3 rounded border text-left transition-colors ${
                selectedType === "orders"
                  ? "border-brand-blue bg-blue-50/40"
                  : "border-surface-border hover:bg-gray-50"
              }`}
            >
              <div className="text-xs font-semibold text-text-primary mb-1">Orders CSV</div>
              <p className="text-[11px] text-text-muted">
                Columns: order_id, order_date, marketplace, sku, product_id, category, quantity, selling_price, order_amount, order_status, warehouse
              </p>
            </button>

            <button
              type="button"
              onClick={() => { setSelectedType("inventory"); setResult(null); }}
              className={`p-3 rounded border text-left transition-colors ${
                selectedType === "inventory"
                  ? "border-brand-blue bg-blue-50/40"
                  : "border-surface-border hover:bg-gray-50"
              }`}
            >
              <div className="text-xs font-semibold text-text-primary mb-1">Inventory CSV</div>
              <p className="text-[11px] text-text-muted">
                Columns: sku, product_id, warehouse, available_quantity, reorder_level, inventory_status, last_updated
              </p>
            </button>
          </div>

          {/* Upload Box */}
          <form onSubmit={handleFileUpload} className="space-y-4">
            <div className="border border-dashed border-surface-border-strong rounded p-8 text-center hover:border-brand-blue transition-colors bg-surface">
              <UploadCloud size={32} className="mx-auto text-text-muted mb-2" />
              <div className="text-xs font-medium text-text-primary">
                Upload {selectedType.toUpperCase()}.CSV
              </div>
              <p className="text-[11px] text-text-muted mt-1">
                Select a valid CSV file from your computer
              </p>

              <input
                type="file"
                accept=".csv"
                id="csvFileInput"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />

              <div className="mt-4 flex items-center justify-center gap-2">
                <label
                  htmlFor="csvFileInput"
                  className="btn-secondary text-xs cursor-pointer inline-flex items-center gap-1.5 h-8"
                >
                  <FileCheck2 size={14} />
                  <span>{file ? file.name : "Select File"}</span>
                </label>

                {file && (
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="btn-primary text-xs h-8 inline-flex items-center gap-1.5"
                  >
                    {isUploading ? "Importing..." : "Upload & Import"}
                  </button>
                )}
              </div>
            </div>
          </form>

          {/* Results Summary Box */}
          {result && (
            <div className={`mt-6 p-4 rounded border text-xs ${
              result.success ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
            }`}>
              <div className="flex items-center gap-2 font-semibold text-xs mb-1.5">
                {result.success ? (
                  <>
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <span className="text-emerald-900">Import Complete</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={16} className="text-red-600" />
                    <span className="text-red-900">Import Error</span>
                  </>
                )}
              </div>
              <p className="text-text-secondary mb-3">{result.message}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2 border-t border-b border-black/10">
                <div>
                  <span className="text-text-muted">Imported:</span>{" "}
                  <span className="font-semibold tabular-nums text-text-primary">{result.imported.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-text-muted">Invalid:</span>{" "}
                  <span className="font-semibold tabular-nums text-text-primary">{result.invalid}</span>
                </div>
              </div>

              {result.errors && result.errors.length > 0 && (
                <div className="mt-3">
                  <div className="font-semibold text-critical mb-1">Errors ({result.errors.length}):</div>
                  <div className="max-h-28 overflow-y-auto space-y-0.5 font-mono text-[11px] bg-white p-2 rounded border border-red-200">
                    {result.errors.map((err, idx) => (
                      <div key={idx} className="text-critical">{err}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
