"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line,
} from "recharts";

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
      {title && <h3 className="text-sm font-semibold text-gray-600 mb-3">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {bars.map((b) => (
            <Bar key={b.key} dataKey={b.key} name={b.name || b.key} fill={b.color} radius={[4, 4, 0, 0]} />
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
      {title && <h3 className="text-sm font-semibold text-gray-600 mb-3">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis angle={30} domain={[0, 1]} tick={{ fontSize: 10 }} />
          <Radar name="Legacy" dataKey="legacy" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
          <Radar name="Modern" dataKey="modern" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Tooltip contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
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
      {title && <h3 className="text-sm font-semibold text-gray-600 mb-3">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {lines.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.name || l.key}
              stroke={l.color}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
