import { LucideIcon } from "lucide-react";
import clsx from "clsx";

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  subtext?: React.ReactNode;
  icon?: LucideIcon;
  accent?: "default" | "success" | "warning" | "critical";
  loading?: boolean;
}

export default function KpiCard({ label, value, subtext, icon: Icon, accent = "default", loading = false }: KpiCardProps) {
  return (
    <div className="card p-4">
      {loading ? (
        <div className="space-y-2">
          <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
          <div className="h-8 bg-gray-200 rounded animate-pulse w-full" />
          <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="text-label-sm font-semibold text-text-muted uppercase tracking-wide">
              {label}
            </span>
            {Icon && (
              <Icon
                size={18}
                className={clsx(
                  "opacity-70",
                  accent === "success" && "text-success",
                  accent === "warning" && "text-warning",
                  accent === "critical" && "text-critical",
                  accent === "default" && "text-text-muted"
                )}
              />
            )}
          </div>
          <div className="text-metric-lg tabular-nums text-text-primary leading-none mb-2 truncate">
            {value}
          </div>
          {subtext && (
            <div className="text-xs text-text-muted truncate">{subtext}</div>
          )}
        </>
      )}
    </div>
  );
}
