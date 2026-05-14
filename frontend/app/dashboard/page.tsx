"use client";
import { useEffect, useState, useRef } from "react";
import { api, Purchase, WasteAlert, DemandPrediction } from "@/services/api";
import { BarChartComponent, LineChartComponent } from "@/components/Chart";
import Table from "@/components/Table";
import { ShoppingCart, AlertTriangle, TrendingUp, ChevronDown, ChevronUp, Zap, ArrowRight, RefreshCw } from "lucide-react";
import { CATEGORY_COLORS, RISK_COLORS, BRAND_COLORS } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";
import { useFetch } from "@/hooks/useFetch";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { formatRupees } from "@/utils/format";
import Link from "next/link";

/* ── Animated number that counts from 0 to `to` on mount ── */
function CountUp({
  to,
  decimals = 0,
  duration = 750,
  prefix = "",
  suffix = "",
}: {
  to: number;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}) {
  const [val, setVal] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (to === 0) { setVal(0); return; }
    const start = Date.now();
    const run = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(to * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(run);
      else setVal(to);
    };
    rafRef.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(rafRef.current);
  }, [to, duration]);

  return <>{prefix}{val.toFixed(decimals)}{suffix}</>;
}

/* ── Budget progress bar with animated fill ── */
function BudgetBar({ spent, budget }: { spent: number; budget: number }) {
  const [barPct, setBarPct] = useState(0);
  const pct    = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const over   = budget > 0 && spent > budget;
  const color  = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-400" : "bg-green-500";

  useEffect(() => {
    const t = setTimeout(() => setBarPct(pct), 150);
    return () => clearTimeout(t);
  }, [pct]);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Monthly Budget</h3>
        <span
          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
            over ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
          }`}
        >
          {over ? `₹${(spent - budget).toFixed(0)} over` : `₹${(budget - spent).toFixed(0)} left`}
        </span>
      </div>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-2xl font-bold text-gray-900">
          ₹<CountUp to={spent} />
        </span>
        <span className="text-sm text-gray-400">of {formatRupees(budget)}</span>
      </div>
      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${barPct}%`, transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1.5">{pct.toFixed(0)}% used this month</p>
    </div>
  );
}

/* ── Compact stat card ── */
function StatCard({
  icon: Icon, label, value, sub, color,
}: {
  icon: React.ElementType; label: string; value: React.ReactNode; sub?: string; color: string;
}) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5 tabular-nums">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

  const { data, loading, error, refresh: load } = useFetch(
    () => Promise.all([api.getPurchases(50), api.predictWaste(), api.predictDemand()]),
    []
  );

  const purchases: Purchase[]         = data?.[0] ?? [];
  const waste: WasteAlert[]           = data?.[1]?.waste_alerts ?? [];
  const demand: DemandPrediction[]    = data?.[2]?.predictions ?? [];

  /* ── derived stats ── */
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
  const budget   = user?.monthly_budget ?? 3000;
  const highRisk = waste.filter((w) => w.risk_level === "High").length;
  const avgConf  = waste.length
    ? waste.reduce((a, w) => a + (1 - w.waste_probability_tabnet), 0) / waste.length
    : 0;

  const purchaseCols = [
    { key: "purchase_date", header: "Date" },
    { key: "item",          header: "Item" },
    {
      key: "category",
      header: "Category",
      render: (r: Purchase) => (
        <span
          className="px-2 py-0.5 rounded text-xs font-medium text-white"
          style={{ background: CATEGORY_COLORS[r.category] || "#6b7280" }}
        >
          {r.category}
        </span>
      ),
    },
    { key: "quantity", header: "Qty",      render: (r: Purchase) => r.quantity.toFixed(2) },
    { key: "price",    header: "Price (₹)", render: (r: Purchase) => `₹${r.price.toFixed(2)}` },
  ];

  const wasteCols = [
    { key: "item",     header: "Item" },
    { key: "category", header: "Category" },
    {
      key: "risk_level",
      header: "Risk",
      render: (r: WasteAlert) => <span className={RISK_COLORS[r.risk_level]}>{r.risk_level}</span>,
    },
    {
      key: "waste_probability_tabnet",
      header: "Probability",
      render: (r: WasteAlert) => `${(r.waste_probability_tabnet * 100).toFixed(1)}%`,
    },
    { key: "days_until_expiry", header: "Days Left" },
  ];

  const [chartsOpen, setChartsOpen] = useLocalStorage("dashboard_charts_open", false);

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
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-56 bg-gray-200 rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map((i) => <div key={i} className="h-32 bg-gray-200 rounded-2xl" />)}
        </div>
        <div className="h-48 bg-gray-200 rounded-2xl" />
      </div>
    );
  }

  /* ── Empty state ── */
  if (purchases.length === 0) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto animate-fade-in">
        {/* Welcome hero */}
        <div
          className="rounded-2xl text-white p-8"
          style={{ background: "linear-gradient(135deg, #1e5c2a 0%, #2d7a3a 100%)" }}
        >
          <h1 className="text-2xl font-bold mb-1">
            Welcome{user ? `, ${user.name.split(" ")[0]}` : ""}! 👋
          </h1>
          <p className="text-green-100 text-sm mb-8">
            SmartGrocery needs a few purchases to start predicting your needs. Let&apos;s set you up.
          </p>

          {/* Step progress */}
          <div className="flex items-start gap-0 mb-8">
            {[
              { n: 1, label: "Add first purchase",   active: true },
              { n: 2, label: "Get first prediction", active: false },
              { n: 3, label: "Track your savings",   active: false },
            ].map((step, i, arr) => (
              <div key={step.n} className="flex items-start flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all ${
                      step.active
                        ? "bg-white text-green-700 shadow-md ring-4 ring-green-400/30"
                        : "bg-green-600/50 text-green-200 border-2 border-green-500/50"
                    }`}
                  >
                    {step.n}
                  </div>
                  <p className={`text-xs mt-2 text-center leading-tight ${step.active ? "text-white font-semibold" : "text-green-300"}`}>
                    {step.label}
                  </p>
                </div>
                {i < arr.length - 1 && <div className="h-0.5 bg-green-500/50 flex-1 mt-4 mx-1" />}
              </div>
            ))}
          </div>

          <Link
            href="/add"
            className="inline-flex items-center gap-2 bg-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-green-50 transition-colors"
            style={{ color: "var(--green-primary)" }}
          >
            <ShoppingCart className="w-4 h-4" /> Add Your First Purchase <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Locked stat cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Monthly Budget",    value: `₹0 / ₹${(user?.monthly_budget ?? 8000).toLocaleString()}`, sub: "Start logging to track" },
            { label: "Waste Risk Alerts", value: "—", sub: "Add items to monitor" },
            { label: "Freshness Score",   value: "—", sub: "Unlocks with data" },
          ].map((c, i) => (
            <div key={c.label} className={`card opacity-50 relative overflow-hidden stagger-${i + 1} animate-slide-up`}>
              <span className="absolute top-2 right-2 text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                Unlocks with data
              </span>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">{c.label}</p>
              <p className="text-xl font-bold text-gray-700">{c.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* What unlocks next */}
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

  type TopAction = { key: string; title: string; subtitle: string; badge: string; badgeColor: string; urgent: boolean };
  const topActions: TopAction[] = [
    ...waste
      .filter((w) => w.risk_level === "High" || w.risk_level === "Medium")
      .map((w) => ({
        key:        `waste-${w.item}`,
        title:      `${w.item} — use before it spoils`,
        subtitle:   `${w.recommendation} · ${w.days_until_expiry} day${w.days_until_expiry !== 1 ? "s" : ""} left`,
        badge:      w.risk_level,
        badgeColor: w.risk_level === "High" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700",
        urgent:     w.risk_level === "High",
      })),
    ...demand
      .filter((d) => d.days_until_next <= 2)
      .map((d) => ({
        key:        `demand-${d.item}`,
        title:      `${d.item} — time to restock`,
        subtitle:   `${d.urgency_message} · Buy ${d.recommended_quantity.toFixed(1)} kg · ₹${d.estimated_cost_inr.toFixed(0)}`,
        badge:      "Buy today",
        badgeColor: "bg-blue-100 text-blue-700",
        urgent:     true,
      })),
  ].slice(0, 3);

  return (
    <div className="space-y-6">

      {/* Greeting */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting}{user ? `, ${user.name.split(" ")[0]}` : ""} ☀️
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{today}</p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* ⚡ Top actions today */}
      {topActions.length > 0 && (
        <div
          className="card animate-slide-up"
          style={{ background: "#fffbf2", borderColor: "#f0d9a8" }}
        >
          <h2
            className="text-sm font-bold flex items-center gap-2 mb-3"
            style={{ color: BRAND_COLORS.amberDeep }}
          >
            <Zap className="w-4 h-4" />
            Today&apos;s top {topActions.length} action{topActions.length > 1 ? "s" : ""}
          </h2>
          <div className="space-y-2">
            {topActions.map((action, i) => (
              <div
                key={action.key}
                className={`flex items-start gap-3 bg-white rounded-xl p-3 border border-yellow-100 animate-slide-up stagger-${i + 1}`}
              >
                <span
                  className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: BRAND_COLORS.amber, color: "white" }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm">{action.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{action.subtitle}</p>
                </div>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${action.badgeColor} ${action.urgent ? "animate-urgent" : ""}`}
                >
                  {action.badge}
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/insights"
            className="flex items-center gap-1 mt-3 text-xs font-semibold hover:underline"
            style={{ color: "var(--green-primary)" }}
          >
            See all insights <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="animate-slide-up stagger-1">
          <BudgetBar spent={currentMonthSpend} budget={budget} />
        </div>
        <div className="animate-slide-up stagger-2">
          <StatCard
            icon={AlertTriangle}
            label="Waste Risk"
            value={<CountUp to={highRisk} />}
            sub={highRisk === 0 ? "All items fresh ✓" : `item${highRisk > 1 ? "s" : ""} need attention`}
            color="bg-red-50 text-red-600"
          />
        </div>
        <div className="animate-slide-up stagger-3">
          <StatCard
            icon={TrendingUp}
            label="Freshness"
            value={<><CountUp to={avgConf * 100} decimals={0} />%</>}
            sub="avg across all items"
            color="bg-purple-50 text-purple-600"
          />
        </div>
      </div>

      {/* Two columns: Recent purchases + Waste risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up stagger-4">
        <div className="card">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Recent Purchases</h2>
          <Table
            columns={purchaseCols as never}
            data={purchases.slice(0, 6) as never}
            emptyMessage="No purchases recorded yet."
          />
          {purchases.length > 6 && (
            <Link
              href="/add"
              className="flex items-center gap-1 mt-3 text-xs font-semibold hover:underline"
              style={{ color: "var(--green-primary)" }}
            >
              View all {purchases.length} purchases <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
        <div className="card">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Items at Waste Risk</h2>
          <Table
            columns={wasteCols as never}
            data={waste.filter((w) => w.risk_level !== "Low").slice(0, 6) as never}
            emptyMessage="No waste alerts — all items look fresh! ✓"
          />
          {waste.filter((w) => w.risk_level !== "Low").length > 0 && (
            <Link
              href="/recommendations"
              className="flex items-center gap-1 mt-3 text-xs font-semibold hover:underline"
              style={{ color: "var(--green-primary)" }}
            >
              View full shopping list <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>

      {/* Charts — collapsed by default */}
      <div className="card animate-slide-up stagger-5">
        <button
          onClick={() => setChartsOpen((o) => !o)}
          className="flex items-center justify-between w-full text-left"
        >
          <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Spending Trends</span>
          <span
            className="flex items-center gap-1 text-xs font-semibold"
            style={{ color: "var(--green-primary)" }}
          >
            {chartsOpen ? "Hide charts" : "Show charts"}
            {chartsOpen
              ? <ChevronUp className="w-4 h-4" />
              : <ChevronDown className="w-4 h-4" />
            }
          </span>
        </button>

        {chartsOpen && (
          <div className="mt-4 space-y-6 animate-fade-in">
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

    </div>
  );
}
