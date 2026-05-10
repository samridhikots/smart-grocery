"use client";
import { useEffect, useState, useCallback } from "react";
import { api, Insight, OverspendingResult } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { Lightbulb, AlertCircle, TrendingUp, Info, ChevronDown, RefreshCw, Zap } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-l-4 border-red-500 bg-red-50",
  high:     "border-l-4 border-orange-400 bg-orange-50",
  medium:   "border-l-4 border-yellow-400 bg-yellow-50",
  info:     "border-l-4 border-blue-400 bg-blue-50",
  low:      "border-l-4 border-gray-300 bg-gray-50",
};

const SEVERITY_ICON_COLOR: Record<string, string> = {
  critical: "text-red-600",
  high:     "text-orange-500",
  medium:   "text-yellow-600",
  info:     "text-blue-500",
  low:      "text-gray-500",
};

function formatValue(key: string, val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number") {
    if (key.includes("spend") || key.includes("amount") || key.includes("budget") || key.includes("avg")) {
      return `₹${val.toFixed(0)}`;
    }
    if (key.includes("prob") || key.includes("score") || key.includes("pct")) {
      return `${(val * (val <= 1 ? 100 : 1)).toFixed(1)}%`;
    }
    return val.toFixed(2);
  }
  return String(val);
}

function InsightCard({ insight }: { insight: Insight }) {
  const [expanded, setExpanded] = useState(false);
  const Icon =
    insight.severity === "critical" || insight.severity === "high"
      ? AlertCircle
      : insight.severity === "info"
      ? Info
      : TrendingUp;

  const dataEntries = insight.data
    ? Object.entries(insight.data).filter(
        ([, v]) => v !== null && v !== undefined && typeof v !== "object"
      )
    : [];

  return (
    <div className={`rounded-xl p-4 ${SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.info}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${SEVERITY_ICON_COLOR[insight.severity]}`} />
          <div>
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <p className="font-semibold text-gray-800 text-sm">{insight.title}</p>
              <span
                className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize ${
                  insight.severity === "critical" ? "bg-red-100 text-red-700" :
                  insight.severity === "high"     ? "bg-orange-100 text-orange-700" :
                  insight.severity === "medium"   ? "bg-yellow-100 text-yellow-700" :
                  insight.severity === "info"     ? "bg-blue-100 text-blue-700" :
                  "bg-gray-100 text-gray-600"
                }`}
              >
                {insight.severity}
              </span>
            </div>
            <p className="text-sm text-gray-600">{insight.message}</p>
          </div>
        </div>
        {dataEntries.length > 0 && (
          <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {expanded && dataEntries.length > 0 && (
        <div className="mt-3 ml-8 bg-white rounded-lg p-3 border border-gray-200 space-y-1.5">
          {dataEntries.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-xs">
              <span className="text-gray-500 capitalize">{k.replace(/_/g, " ")}</span>
              <span className="font-medium text-gray-800">{formatValue(k, v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type HistoryPoint = { month: string; spend: number; is_anomaly: boolean };

function AnomalyDot(props: { cx?: number; cy?: number; payload?: HistoryPoint }) {
  const { cx = 0, cy = 0, payload } = props;
  if (payload?.is_anomaly) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={7} fill="#ef4444" stroke="#fff" strokeWidth={2} />
        <text x={cx} y={cy - 12} textAnchor="middle" fill="#ef4444" fontSize={10} fontWeight={600}>!</text>
      </g>
    );
  }
  return <circle cx={cx} cy={cy} r={3} fill="#22c55e" />;
}

function SpendingHistory({ history }: { history: HistoryPoint[] }) {
  const anomalyCount = history.filter((h) => h.is_anomaly).length;
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-600 mb-3">12-Month Spending Trend</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={history} margin={{ top: 14, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
          <Tooltip
            contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: 12 }}
            formatter={(value, _name, entry) => [
              `₹${Number(value).toFixed(0)}${entry.payload?.is_anomaly ? "  ⚠ Anomaly" : ""}`,
              "Spend",
            ]}
          />
          <Line
            type="monotone"
            dataKey="spend"
            stroke="#22c55e"
            strokeWidth={2}
            dot={<AnomalyDot />}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-5 mt-2 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-green-500" /> Normal spend
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          Anomaly detected{anomalyCount > 0 ? ` (${anomalyCount} month${anomalyCount > 1 ? "s" : ""})` : " — none this year"}
        </div>
      </div>
    </div>
  );
}

export default function InsightsPage() {
  const { user } = useAuth();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [overspending, setOverspending] = useState<OverspendingResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ins, over] = await Promise.all([api.getInsights(), api.getOverspending()]);
      setInsights(ins.insights);
      setOverspending(over);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const criticalCount = insights.filter((i) => i.severity === "critical").length;
  const highCount     = insights.filter((i) => i.severity === "high").length;
  const top3          = insights.filter((i) => i.severity !== "low").slice(0, 3);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-yellow-500" /> My Insights
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Personalised alerts for{" "}
            <span className="font-medium text-gray-700">{user?.name ?? "your household"}</span>
          </p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-1.5 text-sm">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Top 3 Actions Today */}
      {top3.length > 0 && (
        <div className="card border-yellow-200 bg-yellow-50">
          <h2 className="text-sm font-semibold text-yellow-800 flex items-center gap-1.5 mb-3">
            <Zap className="w-4 h-4" /> Your top {top3.length} action{top3.length > 1 ? "s" : ""} today
          </h2>
          <div className="space-y-2">
            {top3.map((ins, i) => (
              <div key={i} className="flex items-start gap-3 bg-white rounded-xl p-3 border border-yellow-100">
                <span className="w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{ins.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{ins.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-3xl font-bold text-red-600">{criticalCount}</p>
          <p className="text-xs text-gray-500 mt-1">Critical Alerts</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-orange-500">{highCount}</p>
          <p className="text-xs text-gray-500 mt-1">High Priority</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-gray-800">{insights.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total Insights</p>
        </div>
        {overspending && (
          <div className={`card text-center ${overspending.is_anomaly ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
            <p className={`text-3xl font-bold ${overspending.is_anomaly ? "text-red-600" : "text-green-600"}`}>
              {overspending.is_anomaly ? "⚠" : "✓"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {overspending.is_anomaly ? "Overspending" : "Spending OK"}
            </p>
          </div>
        )}
      </div>

      {/* Overspending */}
      {overspending && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500" /> Overspending Analysis
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-800">₹{overspending.monthly_spend.toFixed(0)}</p>
              <p className="text-xs text-gray-500 mt-1">This Month</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-800">₹{overspending.avg_3month.toFixed(0)}</p>
              <p className="text-xs text-gray-500 mt-1">3-Month Average</p>
            </div>
            <div className={`rounded-xl p-4 text-center ${overspending.overspend_amount > 0 ? "bg-red-50" : "bg-green-50"}`}>
              <p className={`text-2xl font-bold ${overspending.overspend_amount > 0 ? "text-red-600" : "text-green-600"}`}>
                {overspending.overspend_amount > 0 ? "+" : ""}₹{Math.abs(overspending.overspend_amount).toFixed(0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {overspending.overspend_amount > 0 ? "Over Average" : "Under Average"}
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-6 p-3 bg-blue-50 rounded-lg border border-blue-100">
            {overspending.message}
          </p>
          {overspending.history?.length > 0 && <SpendingHistory history={overspending.history} />}
        </div>
      )}

      {/* All insights */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">All Insights</h2>
        {insights.length === 0 ? (
          <div className="card text-center text-gray-500 py-12">
            No insights yet. Add a few purchases to generate personalised alerts.
          </div>
        ) : (
          insights.map((insight, i) => <InsightCard key={i} insight={insight} />)
        )}
      </div>
    </div>
  );
}
