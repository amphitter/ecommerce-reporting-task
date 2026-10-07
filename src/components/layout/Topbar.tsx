"use client";

import { useRouter } from "next/navigation";
import { RefreshCw, User, ChevronDown } from "lucide-react";
import { useState } from "react";

interface TopbarProps {
  title: string;
  breadcrumb?: string[];
}

export default function Topbar({ title, breadcrumb }: TopbarProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 500);
  };

  return (
    <header className="h-14 border-b border-surface-border bg-white flex items-center justify-between px-6 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <div>
          {breadcrumb && breadcrumb.length > 0 && (
            <div className="text-xs text-text-muted flex items-center gap-1.5">
              {breadcrumb.map((item, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <ChevronDown size={12} className="rotate-[-90deg]" />}
                  <span className={i === breadcrumb.length - 1 ? "text-text-primary font-medium" : ""}>
                    {item}
                  </span>
                </span>
              ))}
            </div>
          )}
          <h1 className="text-lg font-semibold text-text-primary mt-0.5">{title}</h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleRefresh}
          className="h-9 w-9 flex items-center justify-center rounded border border-surface-border bg-white hover:bg-surface transition-colors"
          aria-label="Refresh data"
          disabled={refreshing}
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
        </button>
        <div className="h-9 px-3 flex items-center gap-2 rounded border border-surface-border bg-white">
          <div className="w-7 h-7 rounded-full bg-brand-blue flex items-center justify-center">
            <User size={14} className="text-white" />
          </div>
          <span className="text-sm font-medium text-text-primary hidden sm:block">Admin</span>
        </div>
      </div>
    </header>
  );
}
