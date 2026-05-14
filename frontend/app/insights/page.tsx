"use client";
import { useEffect, useState, useCallback } from "react";
import { api, Insight, OverspendingResult } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { Lightbulb, AlertCircle, TrendingUp, Info, ChevronDown, RefreshCw, Zap, AlertTriangle, ShoppingCart } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { BRAND_COLORS } from "@/lib/constants";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-l-4 border-red-400 bg-red-50",
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
    if (key.includes("spend") || key.includes("amount") || key.includes("budget") || key.includes("avg")) return `₹${val.toFixed(0)}`;
    if (key.includes("prob") || key.includes("score") || key.includes("pct")) return `${(val * (val <= 1 ? 100 : 1)).toFixed(1)}%`;
    return val.toFixed(2);
  }
  return String(val);
}

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 bg-gray-100 rounded-2xl" />
      ))}
    </div>
  );
}

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span>{message}</span>
      </div>
      <button onClick={onRetry} className="flex items-center gap-1.5 font-semibold hover:underline flex-shrink-0">
        <RefreshCw className="w-3.5 h-3.5" /> Retry
      </button>
    </div>
  );
}

function InsightCard({ insight, index = 0 }: { insight: Insight; index?: number }) {
  const [expanded, setExpanded] = useState(false);
  const Icon =
    insight.severity === "critical" || insight.severity === "high" ? AlertCircle
    : insight.severity === "info" ? Info
    : TrendingUp;

  const dataEntries = insight.data
    ? Object.entries(insight.data).filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
    : [];

  return (
    <div className={`rounded-2xl p-4 animate-slide-up stagger-${Math.min(index + 1, 8)} ${SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.info}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${SEVERITY_ICON_COLOR[insight.severity]}`} />
          <div>
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <p className="font-semibold text-gray-800 text-sm">{insight.title}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${
                insight.severity === "critical" ? "bg-red-100 text-red-700" :
                insight.severity === "high"     ? "bg-orange-100 text-orange-700" :
                insight.severity === "medium"   ? "bg-yellow-100 text-yellow-700" :
                insight.severity === "info"     ? "bg-blue-100 text-blue-700" :
                "bg-gray-100 text-gray-600"
              }`}>
                {insight.severity}
              </span>
            </div>
            <p className="text-sm text-gray-600">{insight.message}</p>
          </div>
        </div>
        {dataEntries.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Collapse details" : "Expand details"}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0 transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {expanded && dataEntries.length > 0 && (
        <div className="mt-3 ml-8 bg-white rounded-xl p-3 border border-gray-100 space-y-1.5 animate-fade-in">
          {dataEntries.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-xs">
              <span className="text-gray-500 capitalize">{k.replace(/_/g, " ")}</span>
              <span className="font-semibold text-gray-800">{formatValue(k, v)}</span>
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
        <circle cx={cx} cy={cy} r={7} fill={BRAND_COLORS.red} stroke="#fff" strokeWidth={2} />
        <text x={cx} y={cy - 12} textAnchor="middle" fill={BRAND_COLORS.red} fontSize={10} fontWeight={600}>!</text>
      </g>
    );
  }
  return <circle cx={cx} cy={cy} r={3} fill={BRAND_COLORS.green} />;
}

function SpendingHistory({ history }: { history: HistoryPoint[] }) {
  const anomalyCount = history.filter((h) => h.is_anomaly).length;
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">12-Month Spending Trend</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={history} margin={{ top: 14, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0eeea" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
          <Tooltip
            contentStyle={{ borderRadius: "12px", border: "1.5px solid var(--border-card)", fontSize: 12, background: "#fff" }}
            formatter={(value, _name, entry) => [
              `₹${Number(value).toFixed(0)}${entry.payload?.is_anomaly ? "  ⚠ Anomaly" : ""}`,
              "Spend",
            ]}
          />
          <Line
            type="monotone"
            dataKey="spend"
            stroke={BRAND_COLORS.green}
            strokeWidth={2}
            dot={<AnomalyDot />}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-5 mt-2 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-green-600" /> Normal spend
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          Anomaly{anomalyCount > 0 ? ` (${anomalyCount} month${anomalyCount > 1 ? "s" : ""})` : " — none this year"}
        </div>
      </div>
    </div>
  );
}

type CategoryFilter = "stock" | "waste" | "budget" | null;

export default function InsightsPage() {
  const { user } = useAuth();

  const [insights,           setInsights]           = useState<Insight[]>([]);
  const [overspending,       setOverspending]       = useState<OverspendingResult | null>(null);
  const [insightsLoading,    setInsightsLoading]    = useState(true);
  const [overspendingLoading,setOverspendingLoading]= useState(true);
  const [insightsError,      setInsightsError]      = useState("");
  const [overspendingError,  setOverspendingError]  = useState("");
  const [categoryFilter,     setCategoryFilter]     = useState<CategoryFilter>(null);

  const anyLoading = insightsLoading || overspendingLoading;

  const loadInsights = useCallback(async () => {
    setInsightsLoading(true);
    setInsightsError("");
    try {
      const ins = await api.getInsights();
      setInsights(ins.insights);
    } catch (e: unknown) {
      setInsightsError(e instanceof Error ? e.message : "Failed to load insights");
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  const loadOverspending = useCallback(async () => {
    setOverspendingLoading(true);
    setOverspendingError("");
    try {
      const over = await api.getOverspending();
      setOverspending(over);
    } catch (e: unknown) {
      setOverspendingError(e instanceof Error ? e.message : "Failed to load spending data");
    } finally {
      setOverspendingLoading(false);
    }
  }, []);

  const loadAll = useCallback(() => {
    loadInsights();
    loadOverspending();
  }, [loadInsights, loadOverspending]);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ── Derived insight groups ── */
  const criticalCount  = insights.filter((i) => i.severity === "critical").length;
  const highCount      = insights.filter((i) => i.severity === "high").length;
  const top3           = insights.filter((i) => i.severity !== "low").slice(0, 3);
  const top3Titles     = new Set(top3.map((i) => i.title));

  const stockInsights  = insights.filter((i) => !top3Titles.has(i.title) && (i.type === "demand" || i.title.toLowerCase().includes("stock") || i.title.toLowerCase().includes("running")));
  const wasteInsights  = insights.filter((i) => !top3Titles.has(i.title) && (i.type === "waste"  || i.title.toLowerCase().includes("waste") || i.title.toLowerCase().includes("spoil")));
  const budgetInsights = insights.filter((i) => !top3Titles.has(i.title) && (i.type === "budget" || i.type === "anomaly" || i.title.toLowerCase().includes("spend") || i.title.toLowerCase().includes("budget")));
  const otherInsights  = insights.filter((i) => !top3Titles.has(i.title) && !stockInsights.includes(i) && !wasteInsights.includes(i) && !budgetInsights.includes(i));

  const allGroups = [
    { key: "stock",  label: "Stock Alerts",  color: "text-red-600",    chipColor: "filter-chip-red",    items: stockInsights  },
    { key: "waste",  label: "Waste Alerts",  color: "text-orange-500", chipColor: "filter-chip-orange", items: wasteInsights  },
    { key: "budget", label: "Budget",        color: "text-green-700",  chipColor: "filter-chip-green",  items: budgetInsights },
    { key: "other",  label: "Other",         color: "text-gray-500",   chipColor: "",                   items: otherInsights  },
  ].filter((g) => g.items.length > 0);

  const visibleGroups = categoryFilter
    ? allGroups.filter((g) => g.key === categoryFilter)
    : allGroups;

  return (
    <div className="space-y-8">

      {/* Header — always visible immediately */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-yellow-500" /> My Insights
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Personalised alerts for{" "}
            <span className="font-semibold text-gray-600">{user?.name ?? "your household"}</span>
          </p>
        </div>
        <button onClick={loadAll} disabled={anyLoading} className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${anyLoading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Summary stat cards — insights side shows skeleton, overspending side loads independently */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {insightsLoading ? (
          <>
            {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
          </>
        ) : (
          <>
            {[
              { val: criticalCount,    label: "Critical",       borderColor: "#ef4444", textColor: "#b91c1c" },
              { val: highCount,        label: "High Priority",  borderColor: "#f97316", textColor: "#c2410c" },
              { val: insights.length,  label: "Total Insights", borderColor: "#9ca3af", textColor: "#374151" },
            ].map((s, i) => (
              <div
                key={s.label}
                className={`card border-l-4 animate-slide-up stagger-${i + 1}`}
                style={{ borderLeftColor: s.borderColor }}
              >
                <p className="text-3xl font-bold tabular-nums" style={{ color: s.textColor }}>{s.val}</p>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mt-1">{s.label}</p>
              </div>
            ))}
          </>
        )}

        {/* Overspending card — independent */}
        {overspendingLoading ? (
          <div className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
        ) : overspending ? (
          <div
            className={`card border-l-4 animate-slide-up stagger-4 ${
              overspending.is_anomaly ? "bg-red-50 border-l-red-500" : "bg-green-50 border-l-green-500"
            }`}
          >
            <p className={`text-3xl font-bold ${overspending.is_anomaly ? "text-red-600" : "text-green-600"}`}>
              {overspending.is_anomaly ? "⚠" : "✓"}
            </p>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mt-1">
              {overspending.is_anomaly ? "Overspending" : "Spending OK"}
            </p>
          </div>
        ) : null}
      </div>

      {/* Top 3 actions — shows as soon as insights arrive */}
      {insightsLoading ? (
        <div className="card animate-pulse">
          <div className="h-4 w-48 bg-gray-200 rounded mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}
          </div>
        </div>
      ) : top3.length > 0 && (
        <div
          className="card animate-slide-up stagger-2"
          style={{ background: "#fffbf2", borderColor: "#f0d9a8" }}
        >
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3" style={{ color: BRAND_COLORS.amberDeep }}>
            <Zap className="w-4 h-4" /> Your top {top3.length} action{top3.length > 1 ? "s" : ""} today
          </h2>
          <div className="space-y-2">
            {top3.map((ins, i) => (
              <div key={ins.title} className={`flex items-start gap-3 bg-white rounded-xl p-3 border border-yellow-100 animate-slide-up stagger-${i + 1}`}>
                <span
                  className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5 text-white"
                  style={{ background: BRAND_COLORS.amber }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm">{ins.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{ins.message}</p>
                </div>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                  ins.severity === "critical" ? "bg-red-100 text-red-700 animate-urgent" :
                  ins.severity === "high"     ? "bg-orange-100 text-orange-700" :
                  "bg-gray-100 text-gray-600"
                }`}>
                  {ins.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overspending section — shows as soon as overspending data arrives (~500ms) */}
      {overspendingLoading ? (
        <div className="card animate-pulse space-y-4">
          <div className="h-4 w-40 bg-gray-200 rounded" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}
          </div>
          <div className="h-[280px] bg-gray-100 rounded-xl" />
        </div>
      ) : overspendingError ? (
        <SectionError message={overspendingError} onRetry={loadOverspending} />
      ) : overspending && (
        <div className="card animate-slide-up">
          <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-orange-500" /> Overspending Analysis
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="rounded-xl p-4 text-center" style={{ background: "var(--bg-page)" }}>
              <p className="text-2xl font-bold text-gray-800">₹{overspending.monthly_spend.toFixed(0)}</p>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mt-1">This Month</p>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ background: "var(--bg-page)" }}>
              <p className="text-2xl font-bold text-gray-800">₹{overspending.avg_3month.toFixed(0)}</p>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mt-1">3-Month Avg</p>
            </div>
            <div className={`rounded-xl p-4 text-center ${overspending.overspend_amount > 0 ? "bg-red-50" : "bg-green-50"}`}>
              <p className={`text-2xl font-bold ${overspending.overspend_amount > 0 ? "text-red-600" : "text-green-600"}`}>
                {overspending.overspend_amount > 0 ? "+" : ""}₹{Math.abs(overspending.overspend_amount).toFixed(0)}
              </p>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mt-1">
                {overspending.overspend_amount > 0 ? "Over Average" : "Under Average"}
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
            {overspending.message}
          </p>
          {overspending.history?.length > 0 && <SpendingHistory history={overspending.history} />}
        </div>
      )}

      {/* Grouped insights — shows as soon as insights arrive */}
      {insightsLoading ? (
        <div className="space-y-4">
          <div className="flex gap-2 animate-pulse">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-8 w-20 bg-gray-100 rounded-full" />)}
          </div>
          <SectionSkeleton rows={4} />
        </div>
      ) : insightsError ? (
        <SectionError message={insightsError} onRetry={loadInsights} />
      ) : insights.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No insights yet"
          message="Add a few grocery purchases and we'll generate personalised alerts about waste risk, budget overspend, and restocking needs."
          ctaLabel="Add a purchase"
          ctaHref="/add"
        />
      ) : (
        <div className="space-y-6">
          {/* Filter chips */}
          <div className="flex items-center gap-2 flex-wrap animate-fade-in">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400 mr-1">Filter:</span>
            <button
              onClick={() => setCategoryFilter(null)}
              className={`filter-chip ${categoryFilter === null ? "active filter-chip-green" : ""}`}
            >
              All ({insights.length})
            </button>
            {stockInsights.length > 0 && (
              <button
                onClick={() => setCategoryFilter((f) => f === "stock" ? null : "stock")}
                className={`filter-chip filter-chip-red ${categoryFilter === "stock" ? "active" : ""}`}
              >
                🔴 Stock ({stockInsights.length})
              </button>
            )}
            {wasteInsights.length > 0 && (
              <button
                onClick={() => setCategoryFilter((f) => f === "waste" ? null : "waste")}
                className={`filter-chip filter-chip-orange ${categoryFilter === "waste" ? "active" : ""}`}
              >
                🟡 Waste ({wasteInsights.length})
              </button>
            )}
            {budgetInsights.length > 0 && (
              <button
                onClick={() => setCategoryFilter((f) => f === "budget" ? null : "budget")}
                className={`filter-chip filter-chip-green ${categoryFilter === "budget" ? "active" : ""}`}
              >
                💰 Budget ({budgetInsights.length})
              </button>
            )}
          </div>

          {/* Insight groups */}
          <div className="space-y-6 animate-fade-in" key={categoryFilter ?? "all"}>
            {visibleGroups.map((group) => (
              <div key={group.label}>
                <h3 className={`text-xs font-bold uppercase tracking-widest mb-3 ${group.color}`}>
                  {group.label}
                </h3>
                <div className="space-y-2">
                  {group.items.map((insight, i) => (
                    <InsightCard key={insight.title} insight={insight} index={i} />
                  ))}
                </div>
              </div>
            ))}
            {visibleGroups.length === 0 && (
              <div className="card text-center text-gray-400 py-8 animate-fade-in">
                No {categoryFilter} insights found.
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
