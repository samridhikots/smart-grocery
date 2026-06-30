"use client";
import { useEffect, useState, useCallback } from "react";
import { api, Insight, OverspendingResult } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  Lightbulb, AlertCircle, ChevronDown, RefreshCw,
  Zap, AlertTriangle, ShoppingCart, TrendingUp,
} from "lucide-react";
import AIEnginePanel, { ModelCardData } from "@/components/AIEnginePanel";
import EmptyState from "@/components/EmptyState";
import { BRAND_COLORS } from "@/lib/constants";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import Pagination from "@/components/Pagination";

/* ── Severity config ── */
const SEVERITY_CFG: Record<string, { dot: string; badge: string; ring: string }> = {
  critical: { dot: "bg-red-500",    badge: "bg-red-50 text-red-700",      ring: "ring-1 ring-red-100 shadow-sm" },
  high:     { dot: "bg-orange-500", badge: "bg-orange-50 text-orange-700", ring: "ring-1 ring-orange-100 shadow-sm" },
  medium:   { dot: "bg-amber-400",  badge: "bg-amber-50 text-amber-700",   ring: "" },
  info:     { dot: "bg-blue-400",   badge: "bg-blue-50 text-blue-700",     ring: "" },
  low:      { dot: "bg-gray-300",   badge: "bg-gray-50 text-gray-500",     ring: "" },
};

function formatValue(key: string, val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number") {
    if (key.includes("spend") || key.includes("amount") || key.includes("budget") || key.includes("avg"))
      return `₹${val.toFixed(0)}`;
    if (key.includes("prob") || key.includes("score") || key.includes("pct"))
      return `${(val * (val <= 1 ? 100 : 1)).toFixed(1)}%`;
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

/* ── Stat card with icon container ── */
function InsightStat({ Icon, label, value, iconBg, valueColor }: {
  Icon: React.ElementType; label: string; value: string | number;
  iconBg: string; valueColor: string;
}) {
  return (
    <div className="card flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 tabular-nums ${valueColor}`}>{value}</p>
      </div>
    </div>
  );
}

/* ── Insight card ── */
function InsightCard({ insight, index = 0 }: { insight: Insight; index?: number }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEVERITY_CFG[insight.severity] ?? SEVERITY_CFG.info;

  const dataEntries = insight.data
    ? Object.entries(insight.data).filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
    : [];

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 p-4 animate-slide-up stagger-${Math.min(index + 1, 8)} transition-all ${cfg.ring}`}>
      <div className="flex items-start gap-3">
        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm leading-snug">{insight.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{insight.message}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${cfg.badge}`}>
                {insight.severity}
              </span>
              {dataEntries.length > 0 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  aria-label={expanded ? "Collapse" : "Expand"}
                  className="text-gray-300 hover:text-gray-500 transition-colors ml-0.5"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
          </div>
          {expanded && dataEntries.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 bg-gray-50 rounded-xl p-3 animate-fade-in">
              {dataEntries.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-xs col-span-1">
                  <span className="text-gray-400 capitalize">{k.replace(/_/g, " ")}</span>
                  <span className="font-semibold text-gray-700">{formatValue(k, v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Spending history area chart ── */
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
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={history} margin={{ top: 14, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BRAND_COLORS.green} stopOpacity={0.25} />
              <stop offset="100%" stopColor={BRAND_COLORS.green} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid horizontal vertical={false} stroke="#F1F5F9" strokeDasharray="" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} width={45} />
          <Tooltip
            contentStyle={{ background: "#fff", border: "none", borderRadius: "12px", boxShadow: "0 4px 24px rgba(0,0,0,0.10)", fontSize: 12, padding: "10px 14px" }}
            labelStyle={{ color: "#9ca3af", fontWeight: 600, marginBottom: 4 }}
            formatter={(value, _name, entry) => [
              `₹${Number(value).toFixed(0)}${entry.payload?.is_anomaly ? "  ⚠ Anomaly" : ""}`,
              "Spend",
            ]}
          />
          <Area type="monotone" dataKey="spend" stroke={BRAND_COLORS.green} strokeWidth={2.5}
            fill="url(#spendGradient)" dot={<AnomalyDot />} activeDot={{ r: 5, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-5 mt-2 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-green-500" /> Normal spend
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          Anomaly{anomalyCount > 0 ? ` (${anomalyCount} month${anomalyCount > 1 ? "s" : ""})` : " — none this year"}
        </div>
      </div>
    </div>
  );
}

type InsightTab = "all" | "stock" | "waste" | "budget";

export default function InsightsPage() {
  const { user } = useAuth();

  const [insights,            setInsights]            = useState<Insight[]>([]);
  const [overspending,        setOverspending]        = useState<OverspendingResult | null>(null);
  const [insightsLoading,     setInsightsLoading]     = useState(true);
  const [overspendingLoading, setOverspendingLoading] = useState(true);
  const [insightsError,       setInsightsError]       = useState("");
  const [overspendingError,   setOverspendingError]   = useState("");
  const [activeTab,           setActiveTab]           = useState<InsightTab>("all");
  const [tabPage,             setTabPage]             = useState(1);
  const INSIGHTS_PER_PAGE = 10;

  useEffect(() => setTabPage(1), [activeTab]);

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

  /* ── Derived ── */
  const criticalCount = insights.filter((i) => i.severity === "critical").length;
  const highCount     = insights.filter((i) => i.severity === "high").length;
  const top3          = insights.filter((i) => i.severity !== "low").slice(0, 3);

  const tabContent: Record<InsightTab, Insight[]> = {
    all:    insights,
    stock:  insights.filter((i) =>
      i.type === "demand" ||
      i.title.toLowerCase().includes("stock") ||
      i.title.toLowerCase().includes("running")
    ),
    waste:  insights.filter((i) =>
      i.type === "waste" ||
      i.title.toLowerCase().includes("waste") ||
      i.title.toLowerCase().includes("spoil")
    ),
    budget: insights.filter((i) =>
      i.type === "budget" || i.type === "anomaly" ||
      i.title.toLowerCase().includes("spend") ||
      i.title.toLowerCase().includes("budget")
    ),
  };

  const tabInsights     = tabContent[activeTab];
  const tabTotalPages   = Math.ceil(tabInsights.length / INSIGHTS_PER_PAGE);
  const pagedInsights   = tabInsights.slice((tabPage - 1) * INSIGHTS_PER_PAGE, tabPage * INSIGHTS_PER_PAGE);

  const INSIGHT_TABS: { key: InsightTab; label: string }[] = [
    { key: "all",    label: `All (${insights.length})` },
    { key: "stock",  label: `Stock (${tabContent.stock.length})` },
    { key: "waste",  label: `Waste (${tabContent.waste.length})` },
    { key: "budget", label: `Budget (${tabContent.budget.length})` },
  ];

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-yellow-500" /> My Insights
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Personalised alerts for{" "}
            <span className="font-semibold text-gray-600">{user?.name ?? "your household"}</span>
          </p>
        </div>
        <button onClick={loadAll} disabled={anyLoading} className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${anyLoading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-slide-up">
        {insightsLoading ? (
          <>
            {[1, 2, 3].map((i) => <div key={i} className="h-[76px] bg-gray-100 rounded-2xl animate-pulse" />)}
          </>
        ) : (
          <>
            <InsightStat Icon={AlertCircle}   label="Critical"       value={criticalCount}    iconBg="bg-red-100 text-red-600"     valueColor="text-red-600" />
            <InsightStat Icon={AlertTriangle} label="High Priority"  value={highCount}         iconBg="bg-orange-100 text-orange-600" valueColor="text-orange-600" />
            <InsightStat Icon={Lightbulb}     label="Total Insights" value={insights.length}  iconBg="bg-yellow-100 text-yellow-600" valueColor="text-gray-800" />
          </>
        )}
        {overspendingLoading ? (
          <div className="h-[76px] bg-gray-100 rounded-2xl animate-pulse" />
        ) : overspending ? (
          <InsightStat
            Icon={TrendingUp}
            label={overspending.is_anomaly ? "Overspending" : "Spending OK"}
            value={overspending.is_anomaly ? `+₹${overspending.overspend_amount.toFixed(0)}` : "✓ OK"}
            iconBg={overspending.is_anomaly ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}
            valueColor={overspending.is_anomaly ? "text-red-600" : "text-green-600"}
          />
        ) : null}
      </div>

      {/* ── Top actions + Spending snapshot ── */}
      <div className="grid grid-cols-12 gap-4 animate-slide-up stagger-2">

        {/* Top actions */}
        <div className="col-span-12 lg:col-span-7">
          {insightsLoading ? (
            <div className="card animate-pulse space-y-3">
              <div className="h-4 w-40 bg-gray-200 rounded" />
              {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}
            </div>
          ) : top3.length > 0 ? (
            <div className="card h-full" style={{ background: "#fffbf2", borderColor: "#f0d9a8" }}>
              <h2 className="text-sm font-bold flex items-center gap-2 mb-3" style={{ color: BRAND_COLORS.amberDeep }}>
                <Zap className="w-4 h-4" /> Top {top3.length} action{top3.length > 1 ? "s" : ""} today
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
          ) : (
            <div className="card h-full flex items-center justify-center text-gray-400 py-10">
              <div className="text-center">
                <span className="text-3xl block mb-2">✓</span>
                <p className="text-sm">No urgent actions today</p>
              </div>
            </div>
          )}
        </div>

        {/* Spending snapshot */}
        <div className="col-span-12 lg:col-span-5">
          {overspendingLoading ? (
            <div className="card animate-pulse space-y-3">
              <div className="h-4 w-40 bg-gray-200 rounded" />
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}
              </div>
              <div className="h-8 bg-gray-100 rounded-xl" />
            </div>
          ) : overspendingError ? (
            <SectionError message={overspendingError} onRetry={loadOverspending} />
          ) : overspending ? (
            <div className="card h-full">
              <h2 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" /> Spending Overview
              </h2>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="rounded-xl p-3 text-center" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                  <p className="text-lg font-bold text-gray-800 tabular-nums">₹{overspending.monthly_spend.toFixed(0)}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">This Month</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                  <p className="text-lg font-bold text-gray-800 tabular-nums">₹{overspending.avg_3month.toFixed(0)}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">3-Mo Avg</p>
                </div>
                <div className={`rounded-xl p-3 text-center ${overspending.overspend_amount > 0 ? "bg-red-50" : "bg-green-50"}`}>
                  <p className={`text-lg font-bold tabular-nums ${overspending.overspend_amount > 0 ? "text-red-600" : "text-green-600"}`}>
                    {overspending.overspend_amount > 0 ? "+" : ""}₹{Math.abs(overspending.overspend_amount).toFixed(0)}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">
                    {overspending.overspend_amount > 0 ? "Over Avg" : "Under Avg"}
                  </p>
                </div>
              </div>
              <div className={`text-xs px-3 py-2.5 rounded-xl leading-relaxed ${
                overspending.is_anomaly
                  ? "bg-red-50 text-red-700 border border-red-100"
                  : "bg-green-50 text-green-700 border border-green-100"
              }`}>
                {overspending.message}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Tab section: all insights ── */}
      {insightsLoading ? (
        <div className="card animate-pulse space-y-4">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-8 w-24 bg-gray-100 rounded-lg" />)}
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
        <div className="card animate-slide-up stagger-3">

          {/* Tab bar */}
          <div className="flex items-center gap-1 mb-5 p-1 rounded-xl w-fit" style={{ background: "#F1F5F9" }}>
            {INSIGHT_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === t.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Insight cards */}
          {pagedInsights.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <span className="text-2xl block mb-2">✓</span>
              <p className="text-sm">No {activeTab === "all" ? "" : activeTab + " "}insights found.</p>
            </div>
          ) : (
            <div className="space-y-2 animate-fade-in" key={activeTab}>
              {pagedInsights.map((insight, i) => (
                <InsightCard key={insight.title} insight={insight} index={i} />
              ))}
            </div>
          )}

          <Pagination page={tabPage} totalPages={tabTotalPages} onPageChange={setTabPage} />

          {/* Spending chart — only in Budget tab */}
          {activeTab === "budget" && (overspending?.history?.length ?? 0) > 0 && (
            <div className="mt-6 pt-5 animate-fade-in" style={{ borderTop: "1px solid #F1F5F9" }}>
              <SpendingHistory history={overspending!.history} />
            </div>
          )}
        </div>
      )}

      {/* AI Engine Panel */}
      <AIEnginePanel
        title="AI Engine — Insight Generators"
        models={[
          {
            name: "Isolation Forest", algorithm: "Ensemble (Unsupervised)",
            role: "Anomaly & Overspending Detection",
            metrics: { "Contamination": "10%", "Estimators": "100" },
            features: 3, dataset: "Purchase History (monthly)",
            inference_ms: "<5ms", modelKey: "isolation_forest",
          },
          {
            name: "FP-Growth", algorithm: "Association Rule Mining",
            role: "Smart Recommendations Engine",
            metrics: { "Min support": "1%", "Min confidence": "20%" },
            features: null, dataset: "Grocery Transactions",
            inference_ms: "<10ms", modelKey: "fpgrowth",
          },
        ] as ModelCardData[]}
      />
    </div>
  );
}
