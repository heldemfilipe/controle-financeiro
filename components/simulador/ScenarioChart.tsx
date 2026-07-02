"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { ChartTooltip } from "@/components/ui/ChartTooltip";

interface ScenarioChartProps {
  chartData: Array<{ name: string; Atual: number; [key: string]: number | string }>;
  scenarioName: string;
}

export function ScenarioChart({ chartData, scenarioName }: ScenarioChartProps) {
  return (
    <div className="card">
      <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1">
        Saldo Acumulado — Atual vs {scenarioName}
      </h3>
      <p className="text-xs text-slate-400 mb-3">
        Linha tracejada = cenário atual · Linha sólida = {scenarioName}
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gAtual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#94a3b8" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gCenario" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" strokeOpacity={0.8} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={36} />
          <Tooltip content={<ChartTooltip />} />
          <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Area
            type="monotone" dataKey="Atual"
            stroke="#94a3b8" fill="url(#gAtual)"
            strokeWidth={1.5} strokeDasharray="6 4" dot={false}
          />
          <Area
            type="monotone" dataKey={scenarioName}
            stroke="#6366f1" fill="url(#gCenario)"
            strokeWidth={2.5} dot={{ r: 3, fill: "#6366f1" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
