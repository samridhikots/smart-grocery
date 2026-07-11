"use client";
import { useState } from "react";
import { api, Purchase, WasteAlert, DemandPrediction } from "@/services/api";
import { BarChartComponent, LineChartComponent } from "@/components/Chart";
import Table from "@/components/Table";
import {
  ShoppingCart, AlertTriangle, TrendingUp, ArrowRight, RefreshCw,
  Zap, Package, BarChart2,
} from "lucide-react";
import AIEnginePanel, { ModelCardData } from "@/components/AIEnginePanel";
import Pagination from "@/components/Pagination";
import { CATEGORY_COLORS, RISK_COLORS, BRAND_COLORS } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";
import { useFetch } from "@/hooks/useFetch";
import { formatRupees } from "@/utils/format";
import Link from "next/link";

/* ── Circular score gauge ── */
function ScoreGauge({ score }: { score: number }) {
  const r = 52;
  const cx = 62; const cy = 62;
  const circ = 2 * Math.PI * r;
  const trackArc = circ * 0.75;
  const filledArc = (Math.max(0, Math.min(100, score)) / 100) * trackArc;
  return (
    <svg width="124" height="106" viewBox="0 0 124 106">
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke="rgba(255,255,255,0.15)" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${trackArc} ${circ - trackArc}`}
        transform={`rotate(135 ${cx} ${cy})`}
      />
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke="#84BD00" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${filledArc} ${circ - filledArc}`}
        transform={`rotate(135 ${cx} ${cy})`}
      />
    </svg>
  );
}

/* ── Metric bar inside dark score card ── */
function MetricBar({ label, value, pct, color }: {
  label: string; value: string; pct: number; color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium" style={{ color: "rgba(134,189,0,0.85)" }}>{label}</span>
        <span className="text-[11px] text-white font-bold">{value}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.12)" }}>
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
    </div>
  );
}

/* ── Alert row ── */
function AlertRow({ icon, title, sub, iconCls, dot }: {
  icon: React.ReactNode; title: string; sub: string; iconCls: string; dot: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${iconCls}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 leading-tight">{title}</p>
        <p className="text-xs text-gray-400 mt-0.5 leading-snug">{sub}</p>
      </div>
      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${dot}`} />
    </div>
  );
}

/* ── Goal progress card ── */
function GoalCard({ emoji, title, sub, pct, barColor, meta }: {
  emoji: string; title: string; sub: string; pct: number; barColor: string; meta?: string;
}) {
  return (
    <div className="rounded-xl p-3" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base leading-none">{emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 leading-tight">{title}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-semibold text-gray-700">{Math.min(100, pct)}% complete</span>
        {meta && <span className="text-gray-400">{meta}</span>}
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "#E2E8F0" }}>
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
    </div>
  );
}

type DashTab = "purchases" | "waste" | "demand" | "trends";

export default function Dashboard() {
  const { user } = useAuth();
  const [dashTab, setDashTab] = useState<DashTab>("purchases");
  const [purPage, setPurPage] = useState(1);
  const [wastePage, setWastePage] = useState(1);
  const PUR_PER_PAGE = 10;
  const WASTE_PER_PAGE = 10;

  const { data, loading, error, refresh: load } = useFetch(
    () => Promise.all([api.getPurchases(50), api.predictWaste(), api.predictDemand()]),
    []
  );

  const purchases: Purchase[]      = data?.[0] ?? [];
  const waste: WasteAlert[]        = data?.[1]?.waste_alerts ?? [];
  const demand: DemandPrediction[] = data?.[2]?.predictions ?? [];

  /* ── Derived stats ── */
  const catSpend: Record<string, number> = {};
  purchases.forEach((p) => { catSpend[p.category] = (catSpend[p.category] || 0) + p.price; });
  const spendData = Object.entries(catSpend).map(([category, spend]) => ({
    category, spend: parseFloat(spend.toFixed(2)),
  }));

  const monthlyMap: Record<string, number> = {};
  purchases.forEach((p) => {
    const month = p.purchase_date.slice(0, 7);
    monthlyMap[month] = (monthlyMap[month] || 0) + p.price;
  });
  const monthlyTrend = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, spend]) => ({
      month: new Date(month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      spend: parseFloat(spend.toFixed(2)),
    }));

  const thisMonth         = new Date().toISOString().slice(0, 7);
  const currentMonthSpend = purchases
    .filter((p) => p.purchase_date.startsWith(thisMonth))
    .reduce((a, p) => a + p.price, 0);
  const budget      = user?.monthly_budget ?? 3000;
  const highRisk    = waste.filter((w) => w.risk_level === "High").length;
  const avgConf     = waste.length
    ? waste.reduce((a, w) => a + (1 - w.waste_probability_tabnet), 0) / waste.length
    : 0;
  const highMedWaste = waste.filter((w) => w.risk_level !== "Low");

  /* ── Health scores ── */
  const budgetPct      = budget > 0 ? (currentMonthSpend / budget) * 100 : 0;
  const budgetScore    = Math.max(0, Math.round(100 - budgetPct * 0.5));
  const freshnessScore = Math.round(avgConf * 100);
  const wasteScore     = waste.length > 0
    ? Math.round(((waste.length - highRisk) / waste.length) * 100)
    : 85;
  const overallScore   = Math.round(budgetScore * 0.35 + freshnessScore * 0.40 + wasteScore * 0.25);

  const now      = new Date();
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();

  /* ── Alerts list ── */
  type Alert = { key: string; icon: React.ReactNode; title: string; sub: string; iconCls: string; dot: string };
  const alerts: Alert[] = [
    ...waste
      .filter((w) => w.risk_level === "High" || w.risk_level === "Medium")
      .slice(0, 3)
      .map((w) => ({
        key:     `w-${w.item}`,
        icon:    <AlertTriangle className="w-3.5 h-3.5" />,
        title:   w.item,
        sub:     `${w.recommendation} · ${w.days_until_expiry}d left`,
        iconCls: w.risk_level === "High" ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600",
        dot:     w.risk_level === "High" ? "bg-red-500" : "bg-orange-400",
      })),
    ...demand
      .filter((d) => d.days_until_next <= 3)
      .slice(0, 2)
      .map((d) => ({
        key:     `d-${d.item}`,
        icon:    <ShoppingCart className="w-3.5 h-3.5" />,
        title:   d.item,
        sub:     `Restock soon · Buy ${d.recommended_quantity.toFixed(1)} — ₹${d.estimated_cost_inr.toFixed(0)}`,
        iconCls: "bg-blue-100 text-blue-600",
        dot:     "bg-blue-400",
      })),
    ...(budgetPct > 100 ? [{
      key:     "budget-over",
      icon:    <TrendingUp className="w-3.5 h-3.5" />,
      title:   "Over monthly budget",
      sub:     `₹${(currentMonthSpend - budget).toFixed(0)} over · ${Math.round(budgetPct)}% used`,
      iconCls: "bg-yellow-100 text-yellow-700",
      dot:     "bg-yellow-500",
    }] : []),
  ].slice(0, 5);

  /* ── Pagination slices ── */
  const paginatedPurchases = purchases.slice((purPage - 1) * PUR_PER_PAGE, purPage * PUR_PER_PAGE);
  const paginatedWaste     = highMedWaste.slice((wastePage - 1) * WASTE_PER_PAGE, wastePage * WASTE_PER_PAGE);

  /* ── Table columns ── */
  const purchaseCols = [
    { key: "purchase_date", header: "Date" },
    { key: "item",          header: "Item" },
    {
      key: "category", header: "Category",
      render: (r: Purchase) => (
        <span className="px-2 py-0.5 rounded text-xs font-medium text-white"
          style={{ background: CATEGORY_COLORS[r.category] || "#6b7280" }}>
          {r.category}
        </span>
      ),
    },
    { key: "quantity", header: "Qty",       render: (r: Purchase) => r.quantity.toFixed(2) },
    { key: "price",    header: "Price (₹)", render: (r: Purchase) => `₹${r.price.toFixed(2)}` },
  ];

  const wasteCols = [
    { key: "item",     header: "Item" },
    { key: "category", header: "Category" },
    {
      key: "risk_level", header: "Risk",
      render: (r: WasteAlert) => <span className={RISK_COLORS[r.risk_level]}>{r.risk_level}</span>,
    },
    {
      key: "waste_probability_tabnet", header: "Probability",
      render: (r: WasteAlert) => `${(r.waste_probability_tabnet * 100).toFixed(1)}%`,
    },
    { key: "days_until_expiry", header: "Days Left" },
  ];

  const demandCols = [
    { key: "item",     header: "Item" },
    { key: "category", header: "Category" },
    {
      key: "days_until_next", header: "Buy In",
      render: (r: DemandPrediction) => (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          r.days_until_next <= 2 ? "bg-red-100 text-red-700" :
          r.days_until_next <= 7 ? "bg-orange-100 text-orange-700" :
          "bg-green-100 text-green-700"
        }`}>{r.days_until_next}d</span>
      ),
    },
    { key: "recommended_quantity", header: "Qty",       render: (r: DemandPrediction) => r.recommended_quantity.toFixed(1) },
    { key: "estimated_cost_inr",   header: "Est. Cost", render: (r: DemandPrediction) => `₹${r.estimated_cost_inr.toFixed(0)}` },
  ];

  /* ── Error state ── */
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-8 animate-fade-in">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Failed to load dashboard</h2>
        <p className="text-sm text-gray-500 mb-6 max-w-sm">{error}</p>
        <button onClick={load} className="btn-primary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    );
  }

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-8 w-56 bg-gray-200 rounded-xl" />
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-5 h-72 bg-gray-200 rounded-2xl" />
          <div className="col-span-12 lg:col-span-4 h-72 bg-gray-200 rounded-2xl" />
          <div className="col-span-12 lg:col-span-3 h-72 bg-gray-200 rounded-2xl" />
        </div>
        <div className="h-64 bg-gray-200 rounded-2xl" />
      </div>
    );
  }

  /* ── Empty state ── */
  if (purchases.length === 0) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto animate-fade-in">
        <div className="rounded-2xl text-white p-8" style={{ background: "linear-gradient(135deg, #1e5c2a 0%, #2d7a3a 100%)" }}>
          <h1 className="text-2xl font-bold mb-1">
            Welcome{user ? `, ${user.name.split(" ")[0]}` : ""}! 👋
          </h1>
          <p className="text-green-100 text-sm mb-8">
            SmartGrocery needs a few purchases to start predicting your needs. Let&apos;s set you up.
          </p>
          <div className="flex items-start gap-0 mb-8">
            {[
              { n: 1, label: "Add first purchase",   active: true },
              { n: 2, label: "Get first prediction", active: false },
              { n: 3, label: "Track your savings",   active: false },
            ].map((step, i, arr) => (
              <div key={step.n} className="flex items-start flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all ${
                    step.active
                      ? "bg-white text-green-700 shadow-md ring-4 ring-green-400/30"
                      : "bg-green-600/50 text-green-200 border-2 border-green-500/50"
                  }`}>{step.n}</div>
                  <p className={`text-xs mt-2 text-center leading-tight ${step.active ? "text-white font-semibold" : "text-green-300"}`}>
                    {step.label}
                  </p>
                </div>
                {i < arr.length - 1 && <div className="h-0.5 bg-green-500/50 flex-1 mt-4 mx-1" />}
              </div>
            ))}
          </div>
          <Link href="/add" className="inline-flex items-center gap-2 bg-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-green-50 transition-colors" style={{ color: "var(--green-primary)" }}>
            <ShoppingCart className="w-4 h-4" /> Add Your First Purchase <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Monthly Budget",    value: `₹0 / ₹${(user?.monthly_budget ?? 8000).toLocaleString()}`, sub: "Start logging to track" },
            { label: "Waste Risk Alerts", value: "—", sub: "Add items to monitor" },
            { label: "Freshness Score",   value: "—", sub: "Unlocks with data" },
          ].map((c, i) => (
            <div key={c.label} className={`card opacity-50 relative overflow-hidden stagger-${i + 1} animate-slide-up`}>
              <span className="absolute top-2 right-2 text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Unlocks with data</span>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">{c.label}</p>
              <p className="text-xl font-bold text-gray-700">{c.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>
        <div className="card border-dashed" style={{ borderColor: "#d4cfc8", background: "var(--bg-page)" }}>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">What unlocks as you log more?</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { emoji: "🛒", milestone: "5+ items",  desc: "Waste risk predictions appear" },
              { emoji: "📊", milestone: "10+ items", desc: "Shopping list gets personalised" },
              { emoji: "💰", milestone: "1 month",   desc: "Overspend detection saves ₹500+/mo" },
            ].map((m, i) => (
              <div key={m.milestone} className={`animate-slide-up stagger-${i + 4}`}>
                <div className="text-3xl mb-2">{m.emoji}</div>
                <div className="text-xs font-bold text-gray-700 mb-1">{m.milestone}</div>
                <div className="text-xs text-gray-500 leading-snug">{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── With-data state ── */
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today    = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const TAB_DEFS: { key: DashTab; label: string; Icon: React.ElementType }[] = [
    { key: "purchases", label: "Recent Purchases", Icon: ShoppingCart },
    { key: "waste",     label: "Waste Risk",       Icon: AlertTriangle },
    { key: "demand",    label: "Shopping List",    Icon: Package },
    { key: "trends",    label: "Spending Trends",  Icon: BarChart2 },
  ];

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting}{user ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{today}</p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* ── Top row: Score | Alerts | Goals ── */}
      <div className="grid grid-cols-12 gap-4 animate-slide-up">

        {/* Grocery Score — dark card */}
        <div
          className="col-span-12 lg:col-span-5 rounded-2xl p-5 flex flex-col gap-4"
          style={{ background: "linear-gradient(145deg, #3f7b18 0%, #317a0a 50%, #2b6e09 100%)" }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white font-semibold">Grocery Score</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(134,189,0,0.8)" }}>Overall wellness indicator</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-medium" style={{ color: "rgba(134,189,0,0.9)" }}>Live</span>
            </div>
          </div>

          {/* Gauge + bars */}
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              <ScoreGauge score={overallScore} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pb-3">
                <span className="text-4xl font-bold text-white leading-none tabular-nums flex items-center justify-center">{overallScore}</span>
                {/* <span className="text-sm mt-0.5" style={{ color: "rgba(134,189,0,0.8)" }}>%</span> */}
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <MetricBar
                label="Budget Used"
                value={`${Math.min(200, Math.round(90))}%`}
                pct={Math.min(100, 90)}
                color={budgetPct > 100 ? "bg-red-400" : budgetPct > 80 ? "bg-yellow-400" : "bg-[#84BD00]"}
              />
              <MetricBar label="Freshness" value={`${freshnessScore}%`} pct={freshnessScore} color="bg-blue-400" />
              <MetricBar label="Waste Control" value={`${wasteScore}%`} pct={wasteScore} color="bg-purple-400" />
            </div>
          </div>

          {/* Bottom mini-stats */}
          <div className="grid grid-cols-3 gap-2 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}>
            {[
              { label: "Items Tracked", value: String(purchases.length) },
              { label: "High Risk",     value: `${highRisk} items` },
              { label: "Days Left",     value: `${daysLeft}d` },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-white font-bold text-sm">{s.value}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "rgba(134,189,0,0.7)" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Smart Alerts */}
        <div className="col-span-12 lg:col-span-4 card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
              <Zap className="w-4 h-4 text-yellow-500" /> Smart Alerts
            </h2>
            <span className="text-xs font-semibold bg-red-50 text-red-600 px-2.5 py-0.5 rounded-full border border-red-100">
              {alerts.length} active
            </span>
          </div>

          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <span className="text-3xl mb-2">✓</span>
              <p className="text-sm">All clear — no urgent alerts</p>
            </div>
          ) : (
            alerts.map((a) => (
              <AlertRow key={a.key} icon={a.icon} title={a.title} sub={a.sub} iconCls={a.iconCls} dot={a.dot} />
            ))
          )}

          <Link
            href="/insights"
            className="flex items-center gap-1 mt-3 pt-3 text-xs font-semibold hover:underline"
            style={{ color: "var(--green-primary)", borderTop: "1px solid #F1F5F9" }}
          >
            See all insights <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Active Goals */}
        <div className="col-span-12 lg:col-span-3 card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 text-sm">Active Goals</h2>
            <Link href="/recommendations" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5">
              See more <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            <GoalCard
              emoji="💰"
              title="Monthly Budget"
              sub={`₹${currentMonthSpend.toFixed(0)} of ${formatRupees(budget)}`}
              pct={Math.min(100, Math.round(budgetPct))}
              barColor={budgetPct > 100 ? "bg-red-400" : budgetPct > 80 ? "bg-yellow-400" : "bg-[#84BD00]"}
              meta={`${daysLeft}d left`}
            />
            <GoalCard
              emoji="🌿"
              title="Freshness Goal"
              sub="Keep items fresh"
              pct={freshnessScore}
              barColor="bg-purple-400"
              meta="Ongoing"
            />
            <GoalCard
              emoji="♻️"
              title="Waste Control"
              sub={`${waste.length - highRisk} / ${waste.length} items safe`}
              pct={wasteScore}
              barColor="bg-blue-400"
            />
          </div>
        </div>
      </div>

      {/* ── Tab section ── */}
      <div className="card animate-slide-up stagger-2">

        {/* Tab bar */}
        <div className="flex items-center gap-1 mb-5 p-1 rounded-xl w-fit" style={{ background: "#F1F5F9" }}>
          {TAB_DEFS.map((t) => (
            <button
              key={t.key}
              onClick={() => setDashTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                dashTab === t.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <t.Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Recent Purchases */}
        {dashTab === "purchases" && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                {purchases.length} purchases recorded
              </p>
              <Link href="/add" className="text-xs font-semibold flex items-center gap-1" style={{ color: "var(--green-primary)" }}>
                + Add purchase
              </Link>
            </div>
            <Table columns={purchaseCols as never} data={paginatedPurchases as never} emptyMessage="No purchases recorded yet." />
            <Pagination page={purPage} totalPages={Math.ceil(purchases.length / PUR_PER_PAGE)} onPageChange={setPurPage} />
          </>
        )}

        {/* Waste Risk */}
        {dashTab === "waste" && (
          <>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
              {highMedWaste.length} items at medium or high risk
            </p>
            <Table columns={wasteCols as never} data={paginatedWaste as never} emptyMessage="No waste alerts — all items look fresh! ✓" />
            <Pagination page={wastePage} totalPages={Math.ceil(highMedWaste.length / WASTE_PER_PAGE)} onPageChange={setWastePage} />
            {highMedWaste.length > 0 && (
              <Link href="/recommendations" className="flex items-center gap-1 mt-3 text-xs font-semibold" style={{ color: "var(--green-primary)" }}>
                View full shopping list <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </>
        )}

        {/* Shopping List (demand) */}
        {dashTab === "demand" && (
          <>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
              {demand.length} items predicted by AI
            </p>
            <Table columns={demandCols as never} data={demand.slice(0, 10) as never} emptyMessage="No demand predictions yet." />
            <Link href="/recommendations" className="flex items-center gap-1 mt-3 text-xs font-semibold" style={{ color: "var(--green-primary)" }}>
              See full shopping list <ArrowRight className="w-3 h-3" />
            </Link>
          </>
        )}

        {/* Spending Trends */}
        {dashTab === "trends" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <BarChartComponent
                data={spendData}
                xKey="category"
                bars={[{ key: "spend", color: BRAND_COLORS.green, name: "Spend (₹)" }]}
                title="Spending by Category"
              />
              {(() => {
                const counts: Record<string, number> = { High: 0, Medium: 0, Low: 0 };
                waste.forEach((w) => { counts[w.risk_level]++; });
                const riskData = [
                  { level: "High",   count: counts.High,   fill: "#ef4444" },
                  { level: "Medium", count: counts.Medium, fill: BRAND_COLORS.amber },
                  { level: "Low",    count: counts.Low,    fill: "#22c55e" },
                ];
                return (
                  <BarChartComponent
                    data={riskData}
                    xKey="level"
                    bars={[{ key: "count", color: BRAND_COLORS.green, name: "Items" }]}
                    title="Waste Risk Distribution"
                    height={250}
                  />
                );
              })()}
            </div>
            {monthlyTrend.length >= 2 && (
              <LineChartComponent
                data={monthlyTrend}
                xKey="month"
                lines={[{ key: "spend", color: BRAND_COLORS.green, name: "Monthly Spend (₹)" }]}
                title="Month-over-Month Spend Trend"
                height={280}
              />
            )}
          </div>
        )}
      </div>

      {/* AI Engine Panel */}
      <AIEnginePanel
        title="AI Engine — Dashboard Intelligence"
        models={[
          {
            name: "Isolation Forest", algorithm: "Ensemble (Unsupervised)",
            role: "Overspending Anomaly Detection",
            metrics: { "Contamination": "10%", "Estimators": "100" },
            features: 3, dataset: "Purchase History (monthly)",
            inference_ms: "<5ms", modelKey: "isolation_forest",
          },
        ] as ModelCardData[]}
      />
    </div>
  );
}
