"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

interface WarehouseSalesProps {
  data: Array<{ warehouse: string; sales: number; units: number; percentage: number }>;
  loading?: boolean;
}

const COLORS = ["#2563EB", "#0284C7", "#0D9488", "#4F46E5", "#D97706", "#64748B"];

export default function WarehouseSalesDonut({ data, loading = false }: WarehouseSalesProps) {
  if (loading) {
    return (
      <div className="card p-5 h-[340px] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full border-2 border-brand-blue border-t-transparent animate-spin" />
          <span className="text-xs text-text-muted">Loading warehouse allocation...</span>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="card p-5 h-[340px] flex flex-col items-center justify-center text-center">
        <p className="text-sm font-medium text-text-secondary">No warehouse sales data</p>
        <p className="text-xs text-text-muted mt-1">Orders with assigned warehouses will display here</p>
      </div>
    );
  }

  const totalSales = data.reduce((sum, item) => sum + item.sales, 0);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-text-primary text-sm">Warehouse Sales Distribution</h3>
          <p className="text-xs text-text-muted mt-0.5">Share of valid sales across fulfillment warehouses</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Donut Chart */}
        <div className="h-[210px] w-[210px] relative shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="sales"
                nameKey="warehouse"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    return (
                      <div className="bg-white border border-surface-border p-2.5 rounded-lg shadow-dropdown text-xs">
                        <div className="font-semibold text-text-primary">{item.warehouse}</div>
                        <div className="text-text-secondary mt-1">
                          Sales: <span className="font-medium tabular-nums">${item.sales.toLocaleString()}</span>
                        </div>
                        <div className="text-text-secondary">
                          Share: <span className="font-medium tabular-nums">{item.percentage}%</span>
                        </div>
                        <div className="text-text-muted">
                          Units: <span className="tabular-nums">{item.units.toLocaleString()} pcs</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">Warehouses</span>
            <span className="text-xl font-bold text-text-primary tabular-nums">{data.length}</span>
            <span className="text-[10px] text-text-muted">Active</span>
          </div>
        </div>

        {/* Legend List */}
        <div className="flex-1 w-full space-y-2">
          {data.map((item, index) => {
            const color = COLORS[index % COLORS.length];
            return (
              <div
                key={item.warehouse}
                className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="font-medium text-text-primary truncate">{item.warehouse}</span>
                  <span className="text-text-muted tabular-nums">({item.percentage}%)</span>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold text-text-primary tabular-nums">
                    ${item.sales.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-text-muted tabular-nums">
                    {item.units.toLocaleString()} units
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
