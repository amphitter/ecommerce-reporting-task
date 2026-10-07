"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface SalesTrendProps {
  data: Array<{ date: string; sales: number; returns: number; units: number }>;
  loading?: boolean;
}

export default function SalesTrendChart({ data, loading = false }: SalesTrendProps) {
  if (loading) {
    return (
      <div className="card p-5 h-[340px] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full border-2 border-brand-blue border-t-transparent animate-spin" />
          <span className="text-xs text-text-muted">Loading trend data...</span>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="card p-5 h-[340px] flex flex-col items-center justify-center text-center">
        <p className="text-sm font-medium text-text-secondary">No sales trend data available</p>
        <p className="text-xs text-text-muted mt-1">Try adjusting the filter criteria or date range</p>
      </div>
    );
  }

  const formatCurrency = (val: number) => {
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
    return `$${val}`;
  };

  const formatDate = (val: string) => {
    try {
      const d = new Date(val);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return val;
    }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-text-primary text-sm">Sales & Returns Overview</h3>
          <p className="text-xs text-text-muted mt-0.5">Sales revenue and return amounts over time</p>
        </div>
      </div>

      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="returnGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#DC2626" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#DC2626" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "#E2E8F0" }}
            />
            <YAxis
              tickFormatter={formatCurrency}
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "#E2E8F0" }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white border border-surface-border p-3 rounded-lg shadow-dropdown text-xs">
                      <p className="font-semibold text-text-primary mb-1.5">{label}</p>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-text-secondary">
                            <span className="w-2 h-2 rounded-full bg-brand-blue" />
                            Sales Revenue:
                          </span>
                          <span className="font-semibold text-text-primary tabular-nums">
                            ${Number(payload[0]?.value || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-text-secondary">
                            <span className="w-2 h-2 rounded-full bg-critical" />
                            Return Amount:
                          </span>
                          <span className="font-semibold text-critical tabular-nums">
                            ${Number(payload[1]?.value || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ fontSize: 11, paddingBottom: 10 }}
            />
            <Area
              type="monotone"
              dataKey="sales"
              name="Sales Revenue ($)"
              stroke="#2563EB"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#salesGrad)"
            />
            <Area
              type="monotone"
              dataKey="returns"
              name="Return Leakage ($)"
              stroke="#DC2626"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#returnGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
