"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  AreaChart, Area,
} from "recharts";

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "#fff",
  border: "none",
  borderRadius: "12px",
  boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
  fontSize: 12,
  padding: "10px 14px",
};

const LABEL_STYLE: React.CSSProperties = { color: "#9ca3af", fontWeight: 600, marginBottom: 4 };
const ITEM_STYLE: React.CSSProperties  = { color: "#374151" };
const TICK_STYLE = { fontSize: 11, fill: "#9CA3AF" };
const GRID_PROPS = { horizontal: true, vertical: false, stroke: "#F1F5F9", strokeDasharray: "" };

interface BarProps {
  data: Record<string, unknown>[];
  xKey: string;
  bars: { key: string; color: string; name?: string }[];
  title?: string;
  height?: number;
}

export function BarChartComponent({ data, xKey, bars, title, height = 300 }: BarProps) {
  return (
    <div>
      {title && <h3 className="text-sm font-semibold text-gray-500 mb-3">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }} barCategoryGap="40%">
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey={xKey} tick={TICK_STYLE} axisLine={false} tickLine={false} />
          <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            labelStyle={LABEL_STYLE}
            itemStyle={ITEM_STYLE}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#6b7280" }} />
          {bars.map((b) => (
            <Bar key={b.key} dataKey={b.key} name={b.name || b.key} fill={b.color} radius={[6, 6, 0, 0]} maxBarSize={52} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface RadarProps {
  data: { metric: string; legacy: number; modern: number }[];
  title?: string;
  height?: number;
}

export function RadarChartComponent({ data, title, height = 300 }: RadarProps) {
  return (
    <div>
      {title && <h3 className="text-sm font-semibold text-gray-500 mb-3">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data}>
          <PolarGrid stroke="#F1F5F9" />
          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "#9CA3AF" }} />
          <PolarRadiusAxis angle={30} domain={[0, 1]} tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} />
          <Radar name="Legacy" dataKey="legacy" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} strokeWidth={2} />
          <Radar name="Modern" dataKey="modern" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} strokeWidth={2} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#6b7280" }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={ITEM_STYLE} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface LineProps {
  data: Record<string, unknown>[];
  xKey: string;
  lines: { key: string; color: string; name?: string }[];
  title?: string;
  height?: number;
}

export function LineChartComponent({ data, xKey, lines, title, height = 280 }: LineProps) {
  return (
    <div>
      {title && <h3 className="text-sm font-semibold text-gray-500 mb-3">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            {lines.map((l) => (
              <linearGradient key={l.key} id={`area-grad-${l.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={l.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={l.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey={xKey} tick={TICK_STYLE} axisLine={false} tickLine={false} />
          <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={LABEL_STYLE}
            itemStyle={ITEM_STYLE}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#6b7280" }} />
          {lines.map((l) => (
            <Area
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.name || l.key}
              stroke={l.color}
              strokeWidth={2.5}
              fill={`url(#area-grad-${l.key})`}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 0, fill: l.color }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
