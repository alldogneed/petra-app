"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

export default function RevenueChart({
  data,
  target,
  topService,
}: {
  data: { month: string; amount: number }[];
  target: number;
  topService: { name: string; count: number } | null;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-petra-text">הכנסות</h2>
          {topService && (
            <span className="badge-brand text-[10px]">
              שירות מוביל: {topService.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-petra-muted">
          <div className="w-2 h-2 rounded-full bg-brand-500" />
          הכנסות
          <div className="w-4 border-t border-dashed border-slate-400 mx-1" />
          יעד
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#64748B" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#94A3B8" }}
            tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}k`}
            width={50}
            mirror
          />
          <Tooltip
            formatter={(value: number | undefined) => [formatCurrency(value || 0), "הכנסות"]}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #E2E8F0",
              fontSize: 13,
              direction: "rtl",
            }}
          />
          <ReferenceLine
            y={target}
            stroke="#94A3B8"
            strokeDasharray="6 4"
            label={{
              value: `יעד ${formatCurrency(target)}`,
              position: "insideTopRight",
              fontSize: 11,
              fill: "#94A3B8",
            }}
          />
          <Bar dataKey="amount" fill="#F97316" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
