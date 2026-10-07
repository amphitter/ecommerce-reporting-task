"use client";

import { useEffect, useState } from "react";
import { Filter, X, Calendar, Store, Warehouse, Tag, AlertCircle } from "lucide-react";
import DebouncedInput from "./DebouncedInput";

export interface FilterState {
  from?: string;
  to?: string;
  marketplace?: string;
  warehouse?: string;
  sku?: string;
  category?: string;
  status?: string;
}

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  showSkuSearch?: boolean;
  showStatusFilter?: boolean;
}

export default function FilterBar({
  filters,
  onChange,
  showSkuSearch = true,
  showStatusFilter = true,
}: FilterBarProps) {
  const [options, setOptions] = useState<{
    marketplaces: string[];
    warehouses: string[];
    categories: string[];
  }>({
    marketplaces: [],
    warehouses: [],
    categories: [],
  });

  useEffect(() => {
    fetch("/api/filter-options")
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setOptions({
            marketplaces: data.marketplaces || [],
            warehouses: data.warehouses || [],
            categories: data.categories || [],
          });
        }
      })
      .catch(() => {});
  }, []);

  const hasActiveFilters = Object.values(filters).some(v => v !== undefined && v !== "");

  const handleReset = () => {
    onChange({});
  };

  return (
    <div className="card p-3.5 mb-6">
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Date From */}
        <div className="flex items-center gap-1.5 min-w-[140px]">
          <Calendar size={14} className="text-text-muted shrink-0" />
          <input
            type="date"
            value={filters.from || ""}
            onChange={(e) => onChange({ ...filters, from: e.target.value || undefined })}
            className="input-base text-xs h-8"
            placeholder="From Date"
          />
        </div>

        {/* Date To */}
        <div className="flex items-center gap-1.5 min-w-[140px]">
          <span className="text-text-muted text-xs">to</span>
          <input
            type="date"
            value={filters.to || ""}
            onChange={(e) => onChange({ ...filters, to: e.target.value || undefined })}
            className="input-base text-xs h-8"
            placeholder="To Date"
          />
        </div>

        {/* Marketplace */}
        <div className="min-w-[130px]">
          <select
            value={filters.marketplace || ""}
            onChange={(e) => onChange({ ...filters, marketplace: e.target.value || undefined })}
            className="input-base text-xs h-8"
          >
            <option value="">All Marketplaces</option>
            {options.marketplaces.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Warehouse */}
        <div className="min-w-[130px]">
          <select
            value={filters.warehouse || ""}
            onChange={(e) => onChange({ ...filters, warehouse: e.target.value || undefined })}
            className="input-base text-xs h-8"
          >
            <option value="">All Warehouses</option>
            {options.warehouses.map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>

        {/* Category */}
        <div className="min-w-[130px]">
          <select
            value={filters.category || ""}
            onChange={(e) => onChange({ ...filters, category: e.target.value || undefined })}
            className="input-base text-xs h-8"
          >
            <option value="">All Categories</option>
            {options.categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Order Status */}
        {showStatusFilter && (
          <div className="min-w-[130px]">
            <select
              value={filters.status || ""}
              onChange={(e) => onChange({ ...filters, status: e.target.value || undefined })}
              className="input-base text-xs h-8"
            >
              <option value="">All Statuses</option>
              <option value="Delivered">Delivered</option>
              <option value="Shipped">Shipped</option>
              <option value="Returned">Returned</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        )}

        {/* SKU Search */}
        {showSkuSearch && (
          <div className="w-48">
            <DebouncedInput
              value={filters.sku || ""}
              onChange={(val) => onChange({ ...filters, sku: val || undefined })}
              placeholder="Search SKU..."
              className="text-xs"
            />
          </div>
        )}

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="h-8 px-2.5 rounded text-xs font-medium text-critical hover:bg-critical-bg flex items-center gap-1 transition-colors ml-auto"
          >
            <X size={14} />
            <span>Clear Filters</span>
          </button>
        )}
      </div>
    </div>
  );
}
