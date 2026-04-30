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
  const total = data.reduce((s, d) => s + d.amount, 0);
  return (
    <div className="card p-6">
      <div className="flex items-end justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-petra-text">הכנסות אחרונות</h2>
          <p className="text-xs text-petra-muted mt-0.5">
            סה&quot;כ {formatCurrency(total)}
            {topService && <span className="text-slate-300 mx-1.5">·</span>}
            {topService && <span>שירות מוביל: <span className="text-petra-text font-medium">{topService.name}</span></span>}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-petra-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brand-500" />
            הכנסות
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 border-t border-dashed border-slate-400" />
            יעד
          </span>
        </div>
      </div>
      <div
        role="img"
        aria-label={`גרף הכנסות חודשי. סה"כ ${formatCurrency(total)} בתקופה הנבחרת`}
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="brandBarFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F97316" />
                <stop offset="100%" stopColor="#FB923C" />
              </linearGradient>
            </defs>
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
              tickFormatter={(v: number) => {
                if (v === 0) return "";
                return "\u20AA" + v.toLocaleString("he-IL");
              }}
              width={60}
            />
            <Tooltip
              formatter={(value: number | undefined) => [formatCurrency(value || 0), "הכנסות"]}
              labelFormatter={(label) => label}
              cursor={{ fill: "rgba(249,115,22,0.06)" }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #E2E8F0",
                fontSize: 13,
                direction: "rtl",
                boxShadow: "0 8px 24px -4px rgba(0,0,0,0.1)",
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
            <Bar dataKey="amount" fill="url(#brandBarFill)" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
