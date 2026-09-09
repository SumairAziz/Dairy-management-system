"use client";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import type { ParsedChartBlock } from "@/lib/ai/blocks.schema";
import { chartColor } from "@/app/components/custom-charts";

/**
 * Renders one `ui-chart` block emitted by the assistant, using Recharts as
 * requested. Isolated to `components/assistant/` — the rest of the app keeps
 * using its own hand-rolled SVG charts (`app/components/custom-charts.tsx`);
 * only the AI module depends on Recharts.
 */
export function ChartRenderer({ block }: { block: ParsedChartBlock }) {
  const { chartType, data, xKey, series, yLabel, title } = block;

  const axisColor = "rgba(148,163,184,0.5)";
  const gridColor = "rgba(148,163,184,0.15)";

  const tooltipStyle = {
    background: "rgba(15,23,42,0.95)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    fontSize: 12,
    color: "#e2e8f0",
  };

  return (
    <div className="my-3 surface border rounded-xl p-4">
      {title && <div className="text-sm font-semibold mb-3">{title}</div>}
      <ResponsiveContainer width="100%" height={280}>
        {chartType === "pie" ? (
          <PieChart>
            <Pie
              data={data}
              dataKey={series[0]?.key ?? "value"}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={(entry: any) => String(entry[xKey] ?? entry.name ?? "")}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={chartColor(i)} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        ) : chartType === "bar" || chartType === "stacked-bar" ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="4 4" stroke={gridColor} />
            <XAxis dataKey={xKey} tick={{ fill: axisColor, fontSize: 11 }} />
            <YAxis tick={{ fill: axisColor, fontSize: 11 }} label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft", fill: axisColor, fontSize: 11 } : undefined} />
            <Tooltip contentStyle={tooltipStyle} />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label ?? s.key}
                fill={s.color ?? chartColor(i)}
                stackId={chartType === "stacked-bar" ? "stack" : undefined}
                radius={chartType === "stacked-bar" ? undefined : [4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        ) : chartType === "area" ? (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="4 4" stroke={gridColor} />
            <XAxis dataKey={xKey} tick={{ fill: axisColor, fontSize: 11 }} />
            <YAxis tick={{ fill: axisColor, fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {series.map((s, i) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label ?? s.key}
                stroke={s.color ?? chartColor(i)}
                fill={s.color ?? chartColor(i)}
                fillOpacity={0.25}
              />
            ))}
          </AreaChart>
        ) : (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="4 4" stroke={gridColor} />
            <XAxis dataKey={xKey} tick={{ fill: axisColor, fontSize: 11 }} />
            <YAxis tick={{ fill: axisColor, fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label ?? s.key}
                stroke={s.color ?? chartColor(i)}
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
