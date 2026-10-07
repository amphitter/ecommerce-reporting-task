"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export default function Pagination({
  page,
  totalPages,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("...");
      const startPage = Math.max(2, page - 1);
      const endPage = Math.min(totalPages - 1, page + 1);
      for (let i = startPage; i <= endPage; i++) pages.push(i);
      if (page < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-4 border-t border-surface-border text-sm">
      <div className="text-text-muted">
        Showing <span className="font-medium text-text-primary">{start}</span> to{" "}
        <span className="font-medium text-text-primary">{end}</span> of{" "}
        <span className="font-medium text-text-primary">{total}</span>
      </div>

      <div className="flex items-center gap-4">
        {onPageSizeChange && (
          <div className="flex items-center gap-2 text-text-muted">
            <span>Show:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded border border-surface-border px-2 text-sm bg-white"
            >
              {[25, 50, 100].map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="h-8 w-8 flex items-center justify-center rounded border border-surface-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronLeft size={16} />
          </button>

          {getPageNumbers().map((p, i) =>
            typeof p === "number" ? (
              <button
                key={i}
                onClick={() => onPageChange(p)}
                className={`h-8 w-8 flex items-center justify-center rounded text-sm font-medium ${
                  p === page
                    ? "bg-brand-blue text-white"
                    : "border border-surface-border hover:bg-gray-50 text-text-secondary"
                }`}
              >
                {p}
              </button>
            ) : (
              <span key={i} className="h-8 w-8 flex items-center justify-center text-text-muted">
                {p}
              </span>
            )
          )}

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="h-8 w-8 flex items-center justify-center rounded border border-surface-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
