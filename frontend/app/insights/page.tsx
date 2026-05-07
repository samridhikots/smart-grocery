"use client";
import { useEffect, useState, useCallback } from "react";
import { api, Insight, OverspendingResult } from "@/services/api";
import { Lightbulb, AlertCircle, TrendingUp, Info, ChevronDown, RefreshCw } from "lucide-react";
import { BarChartComponent } from "@/components/Chart";

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

function InsightCard({ insight }: { insight: Insight }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = insight.severity === "critical" || insight.severity === "high"
    ? AlertCircle
    : insight.severity === "info"
    ? Info
    : TrendingUp;

  return (
    <div className={`rounded-xl p-4 ${SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.info}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${SEVERITY_ICON_COLOR[insight.severity]}`} />
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-semibold text-gray-800 text-sm">{insight.title}</p>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize ${
                insight.severity === "critical" ? "bg-red-100 text-red-700" :
                insight.severity === "high" ? "bg-orange-100 text-orange-700" :
                insight.severity === "medium" ? "bg-yellow-100 text-yellow-700" :
                insight.severity === "info" ? "bg-blue-100 text-blue-700" :
                "bg-gray-100 text-gray-600"
              }`}>
                {insight.severity}
              </span>
            </div>
            <p className="text-sm text-gray-600">{insight.message}</p>
          </div>
        </div>
        {insight.data && (
          <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
      {expanded && insight.data && (
        <div className="mt-3 ml-8 text-xs text-gray-500 bg-white rounded-lg p-3 border border-gray-200">
          <pre className="whitespace-pre-wrap">{JSON.stringify(insight.data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function SpendingHistory({ history }: { history: { month: string; spend: number; is_anomaly: boolean }[] }) {
  const chartData = history.map((h) => ({
    month: h.month,
    spend: h.spend,
    anomaly: h.is_anomaly ? h.spend : 0,
  }));

  return (
    <BarChartComponent
      data={chartData}
      xKey="month"
      bars={[
        { key: "spend", color: "#22c55e", name: "Monthly Spend (₹)" },
        { key: "anomaly", color: "#ef4444", name: "Anomaly Detected" },
      ]}
      title="12-Month Spending History"
      height={280}
    />
  );
}

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [overspending, setOverspending] = useState<OverspendingResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userId] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ins, over] = await Promise.all([
        api.getInsights(userId),
        api.getOverspending(userId),
      ]);
      setInsights(ins.insights);
      setOverspending(over);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const criticalCount = insights.filter((i) => i.severity === "critical").length;
  const highCount = insights.filter((i) => i.severity === "high").length;

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
          <p className="text-gray-500 text-sm mt-1">Personalized alerts from all 7 ML models for User #{userId}.</p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-1.5 text-sm">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
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

      {/* Overspending section */}
      {overspending && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500" /> Overspending Analysis (Isolation Forest)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-800">₹{overspending?.monthly_spend.toFixed(0)}</p>
              <p className="text-xs text-gray-500 mt-1">This Month</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-800">₹{overspending?.avg_3month.toFixed(0)}</p>
              <p className="text-xs text-gray-500 mt-1">3-Month Average</p>
            </div>
            <div className={`rounded-xl p-4 text-center ${overspending?.overspend_amount > 0 ? "bg-red-50" : "bg-green-50"}`}>
              <p className={`text-2xl font-bold ${overspending?.overspend_amount > 0 ? "text-red-600" : "text-green-600"}`}>
                {overspending?.overspend_amount > 0 ? "+" : ""}₹{Math.abs(overspending?.overspend_amount).toFixed(0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {overspending?.overspend_amount > 0 ? "Over Average" : "Under Average"}
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-6 p-3 bg-blue-50 rounded-lg border border-blue-100">
            {overspending?.message}
          </p>
          {overspending?.history && overspending?.history.length > 0 && (
            <SpendingHistory history={overspending?.history} />
          )}
        </div>
      )}

      {/* Insights list */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">All Insights (sorted by priority)</h2>
        {insights.length === 0 ? (
          <div className="card text-center text-gray-500 py-12">
            No insights available yet. Add purchases to generate personalized insights.
          </div>
        ) : (
          insights.map((insight, i) => <InsightCard key={i} insight={insight} />)
        )}
      </div>
    </div>
  );
}
