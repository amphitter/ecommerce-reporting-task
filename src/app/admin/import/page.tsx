"use client";

import { useState, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  UploadCloud,
  FileCheck2,
  AlertCircle,
  Database,
  CheckCircle2,
  Package,
  ShoppingCart,
  Warehouse,
  Trash2,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

type ImportType = "products" | "orders" | "inventory";

interface ImportCounts {
  products: number;
  orders: number;
  inventory: number;
}

export default function ImportPage() {
  const [counts, setCounts] = useState<ImportCounts>({ products: 0, orders: 0, inventory: 0 });
  const [selectedType, setSelectedType] = useState<ImportType>("products");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
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
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, []);

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

  const handleLoadSample = async (type: ImportType) => {
    setIsUploading(true);
    setResult(null);

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "load_sample", type }),
      });
      const data = await res.json();
      setResult(data);
      if (data.counts) setCounts(data.counts);
    } catch {
      setResult({
        success: false,
        imported: 0,
        invalid: 0,
        errors: ["Failed to import sample file"],
        message: "Sample import failed",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearDatabase = async () => {
    if (!confirm("Are you sure you want to clear all data in the database? This cannot be undone.")) return;
    setIsClearing(true);
    try {
      await fetch("/api/import", { method: "DELETE" });
      setResult({
        success: true,
        imported: 0,
        invalid: 0,
        errors: [],
        message: "Database tables cleared successfully",
      });
      await fetchCounts();
    } catch {
      alert("Failed to clear database");
    } finally {
      setIsClearing(false);
    }
  };

  const allImported = counts.products > 0 && counts.orders > 0 && counts.inventory > 0;

  return (
    <AppShell title="CSV Import & Pipeline Manager" breadcrumb={["NexusOps", "Admin", "Data Import"]}>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg bg-white border border-surface-border">
          <div>
            <h2 className="text-base font-semibold text-text-primary">E-commerce Data Import Engine</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Import and validate Products (1,000), Orders (5,000), and Inventory (4,000) datasets. Idempotent bulk upsert with warehouse allocation rules applied automatically.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchCounts}
              className="btn-secondary text-xs flex items-center gap-1.5 h-8"
              title="Refresh counts"
            >
              <RefreshCw size={13} />
              <span>Refresh Status</span>
            </button>
            <button
              onClick={handleClearDatabase}
              disabled={isClearing}
              className="btn-destructive text-xs flex items-center gap-1.5 h-8"
            >
              <Trash2 size={13} />
              <span>Clear Database</span>
            </button>
          </div>
        </div>

        {/* Database Live Ledger Counts */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-4">
            <div className="flex items-center justify-between text-xs text-text-muted mb-1">
              <span className="font-semibold uppercase tracking-wider">Products Table</span>
              <Package size={16} className="text-brand-blue" />
            </div>
            <div className="text-2xl font-bold text-text-primary tabular-nums">
              {counts.products.toLocaleString()}
            </div>
            <div className="text-[11px] text-text-muted mt-1 flex items-center gap-1">
              {counts.products > 0 ? (
                <span className="text-success font-medium flex items-center gap-1">
                  <CheckCircle2 size={12} /> Ready for Reporting
                </span>
              ) : (
                <span className="text-warning font-medium">Pending Import</span>
              )}
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between text-xs text-text-muted mb-1">
              <span className="font-semibold uppercase tracking-wider">Orders Table</span>
              <ShoppingCart size={16} className="text-brand-blue" />
            </div>
            <div className="text-2xl font-bold text-text-primary tabular-nums">
              {counts.orders.toLocaleString()}
            </div>
            <div className="text-[11px] text-text-muted mt-1 flex items-center gap-1">
              {counts.orders > 0 ? (
                <span className="text-success font-medium flex items-center gap-1">
                  <CheckCircle2 size={12} /> Ready for Reporting
                </span>
              ) : (
                <span className="text-warning font-medium">Pending Import</span>
              )}
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between text-xs text-text-muted mb-1">
              <span className="font-semibold uppercase tracking-wider">Inventory Table</span>
              <Warehouse size={16} className="text-brand-blue" />
            </div>
            <div className="text-2xl font-bold text-text-primary tabular-nums">
              {counts.inventory.toLocaleString()}
            </div>
            <div className="text-[11px] text-text-muted mt-1 flex items-center gap-1">
              {counts.inventory > 0 ? (
                <span className="text-success font-medium flex items-center gap-1">
                  <CheckCircle2 size={12} /> Ready for Reporting
                </span>
              ) : (
                <span className="text-warning font-medium">Pending Import</span>
              )}
            </div>
          </div>
        </div>

        {/* Success Banner if all datasets imported */}
        {allImported && (
          <div className="card p-4 bg-emerald-50 border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <div className="text-sm font-semibold text-emerald-950">
                  All 3 Datasets Successfully Synced!
                </div>
                <div className="text-xs text-emerald-800">
                  Products (1,000), Orders (5,000), and Inventory (4,000) are fully populated. Dashboard & reports are live.
                </div>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="btn-primary text-xs flex items-center justify-center gap-1.5 h-8 bg-emerald-600 hover:bg-emerald-700 whitespace-nowrap"
            >
              <span>View Dashboard</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        )}

        {/* Import Controls Card */}
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Database size={16} className="text-brand-blue" />
            <span>Select CSV Dataset to Import</span>
          </h3>

          {/* Type Selector Tabs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <button
              type="button"
              onClick={() => { setSelectedType("products"); setResult(null); }}
              className={`p-3 rounded-lg border text-left transition-all ${
                selectedType === "products"
                  ? "border-brand-blue bg-blue-50/50 shadow-sm"
                  : "border-surface-border hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-text-primary">1. Products CSV</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-brand-blue font-bold">1,000 rows</span>
              </div>
              <p className="text-[11px] text-text-muted">
                SKU, product name, category, brand, selling price, cost, default warehouse.
              </p>
            </button>

            <button
              type="button"
              onClick={() => { setSelectedType("orders"); setResult(null); }}
              className={`p-3 rounded-lg border text-left transition-all ${
                selectedType === "orders"
                  ? "border-brand-blue bg-blue-50/50 shadow-sm"
                  : "border-surface-border hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-text-primary">2. Orders CSV</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-brand-blue font-bold">5,000 rows</span>
              </div>
              <p className="text-[11px] text-text-muted">
                Order date, marketplace, SKU, quantity, status, warehouse allocation rule.
              </p>
            </button>

            <button
              type="button"
              onClick={() => { setSelectedType("inventory"); setResult(null); }}
              className={`p-3 rounded-lg border text-left transition-all ${
                selectedType === "inventory"
                  ? "border-brand-blue bg-blue-50/50 shadow-sm"
                  : "border-surface-border hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-text-primary">3. Inventory CSV</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-brand-blue font-bold">4,000 rows</span>
              </div>
              <p className="text-[11px] text-text-muted">
                SKU, warehouse, available quantity, reorder level, stock status.
              </p>
            </button>
          </div>

          {/* Business Rule Callout */}
          {selectedType === "orders" && (
            <div className="p-3 mb-6 bg-slate-50 border border-slate-200 rounded-lg text-xs text-text-secondary">
              <span className="font-semibold text-text-primary">Warehouse Allocation Business Rule:</span>
              <p className="mt-0.5 text-text-muted">
                If <code className="font-mono text-brand-blue">allocated_warehouse</code> is present &rarr; use it.
                Else if <code className="font-mono text-brand-blue">default_warehouse</code> is present &rarr; use it.
                Else &rarr; <code className="font-mono text-slate-700">&quot;Warehouse Not Assigned&quot;</code>.
                Derived canonically on import.
              </p>
            </div>
          )}

          {/* Upload Form */}
          <form onSubmit={handleFileUpload} className="space-y-4">
            <div className="border-2 border-dashed border-surface-border-strong rounded-lg p-6 text-center hover:border-brand-blue transition-colors bg-slate-50/50">
              <UploadCloud size={32} className="mx-auto text-brand-blue mb-2" />
              <div className="text-xs font-semibold text-text-primary">
                Upload {selectedType.toUpperCase()}.CSV
              </div>
              <p className="text-[11px] text-text-muted mt-1">
                Drag and drop your file here, or click Browse to select from computer
              </p>

              <input
                type="file"
                accept=".csv"
                id="csvFileInput"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />

              <div className="mt-3 flex items-center justify-center gap-2">
                <label
                  htmlFor="csvFileInput"
                  className="btn-secondary text-xs cursor-pointer inline-flex items-center gap-1.5 h-8"
                >
                  <FileCheck2 size={14} />
                  <span>{file ? file.name : "Browse CSV File"}</span>
                </label>

                {file && (
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="btn-primary text-xs h-8 inline-flex items-center gap-1.5"
                  >
                    {isUploading ? "Importing..." : `Import ${file.name}`}
                  </button>
                )}
              </div>
            </div>

            {/* Quick 1-Click Import Provided Sample */}
            <div className="p-4 rounded-lg bg-blue-50/60 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-blue-900">
                  Quick Load: Pre-uploaded assignment sample ({selectedType}.csv)
                </div>
                <div className="text-[11px] text-blue-700">
                  Instantly load and parse the official {selectedType}.csv from the project repository.
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleLoadSample(selectedType)}
                disabled={isUploading}
                className="btn-primary text-xs h-8 whitespace-nowrap bg-blue-600 hover:bg-blue-700"
              >
                {isUploading ? "Processing..." : `1-Click Import ${selectedType.toUpperCase()} Sample`}
              </button>
            </div>
          </form>

          {/* Results Summary Box */}
          {result && (
            <div className={`mt-6 p-4 rounded-lg border text-xs ${
              result.success ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
            }`}>
              <div className="flex items-center gap-2 font-semibold text-sm mb-2">
                {result.success ? (
                  <>
                    <CheckCircle2 size={18} className="text-emerald-600" />
                    <span className="text-emerald-950">Import Result: Success</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={18} className="text-red-600" />
                    <span className="text-red-950">Import Result: Issues Detected</span>
                  </>
                )}
              </div>
              <p className="text-text-secondary font-medium mb-2">{result.message}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2 border-t border-b border-black/10">
                <div>
                  <span className="text-text-muted">Imported Rows:</span>{" "}
                  <span className="font-bold tabular-nums text-text-primary">{result.imported.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-text-muted">Invalid Rows:</span>{" "}
                  <span className="font-bold tabular-nums text-text-primary">{result.invalid}</span>
                </div>
                <div>
                  <span className="text-text-muted">Status:</span>{" "}
                  <span className="font-bold text-text-primary">{result.success ? "Completed" : "Failed"}</span>
                </div>
              </div>

              {result.errors && result.errors.length > 0 && (
                <div className="mt-3">
                  <div className="font-semibold text-critical mb-1">Errors Encountered ({result.errors.length}):</div>
                  <div className="max-h-32 overflow-y-auto space-y-1 font-mono text-[11px] bg-white/70 p-2 rounded">
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
