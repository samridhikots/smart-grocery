"use client";
import { useEffect, useState, useCallback } from "react";
import { api, Purchase, WasteAlert } from "@/services/api";
import { BarChartComponent, LineChartComponent } from "@/components/Chart";
import Table from "@/components/Table";
import { ShoppingCart, AlertTriangle, TrendingUp, DollarSign, ChevronDown, ChevronUp, Zap, ArrowRight } from "lucide-react";
import { CATEGORY_COLORS, RISK_COLORS } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function BudgetBar({ spent, budget }: { spent: number; budget: number }) {
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const over = budget > 0 && spent > budget;
  const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-400" : "bg-green-500";
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Monthly Budget</h3>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${over ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
          {over ? `₹${(spent - budget).toFixed(0)} over` : `₹${(budget - spent).toFixed(0)} left`}
        </span>
      </div>
      <div className="flex items-end gap-2 mb-2">
        <span className="text-2xl font-bold text-gray-900">₹{spent.toFixed(0)}</span>
        <span className="text-sm text-gray-400 mb-0.5">of ₹{budget.toFixed(0)}</span>
      </div>
      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">{pct.toFixed(0)}% used this month</p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [waste, setWaste] = useState<WasteAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, w] = await Promise.all([api.getPurchases(200), api.predictWaste()]);
      setPurchases(p);
      setWaste(w.waste_alerts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Category spend
  const catSpend: Record<string, number> = {};
  purchases.forEach((p) => {
    catSpend[p.category] = (catSpend[p.category] || 0) + p.price;
  });
  const spendData = Object.entries(catSpend).map(([category, spend]) => ({
    category,
    spend: parseFloat(spend.toFixed(2)),
  }));

  // Monthly spend trend
  const monthlyMap: Record<string, number> = {};
  purchases.forEach((p) => {
    const month = p.purchase_date.slice(0, 7); // YYYY-MM
    monthlyMap[month] = (monthlyMap[month] || 0) + p.price;
  });
  const monthlyTrend = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, spend]) => ({
      month: new Date(month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      spend: parseFloat(spend.toFixed(2)),
    }));

  // Current month spend vs budget
  const thisMonth = new Date().toISOString().slice(0, 7);
  const currentMonthSpend = purchases
    .filter((p) => p.purchase_date.startsWith(thisMonth))
    .reduce((a, p) => a + p.price, 0);
  const budget = user?.monthly_budget ?? 3000;

  const totalSpend = purchases.reduce((a, p) => a + p.price, 0);
  const highRisk = waste.filter((w) => w.risk_level === "High").length;
  const avgConf = waste.length
    ? waste.reduce((a, w) => a + (1 - w.waste_probability_tabnet), 0) / waste.length
    : 0;

  const purchaseCols = [
    { key: "purchase_date", header: "Date" },
    { key: "item", header: "Item" },
    { key: "category", header: "Category",
      render: (r: Purchase) => (
        <span className="px-2 py-0.5 rounded text-xs font-medium text-white" style={{ background: CATEGORY_COLORS[r.category] || "#6b7280" }}>
          {r.category}
        </span>
      ),
    },
    { key: "quantity", header: "Qty", render: (r: Purchase) => r.quantity.toFixed(2) },
    { key: "price", header: "Price (₹)", render: (r: Purchase) => `₹${r.price.toFixed(2)}` },
  ];

  const wasteCols = [
    { key: "item", header: "Item" },
    { key: "category", header: "Category" },
    { key: "risk_level", header: "Risk",
      render: (r: WasteAlert) => (
        <span className={RISK_COLORS[r.risk_level]}>{r.risk_level}</span>
      ),
    },
    { key: "waste_probability_tabnet", header: "Probability",
      render: (r: WasteAlert) => `${(r.waste_probability_tabnet * 100).toFixed(1)}%`,
    },
    { key: "days_until_expiry", header: "Days Left" },
  ];

  const [chartsOpen, setChartsOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  /* ── Empty state: no purchases yet ── */
  if (purchases.length === 0) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Welcome hero */}
        <div className="rounded-2xl bg-gradient-to-br from-green-700 to-green-500 text-white p-8">
          <h1 className="text-2xl font-bold mb-1">
            Welcome{user ? `, ${user.name.split(" ")[0]}` : ""}! 👋
          </h1>
          <p className="text-green-100 text-sm mb-8">
            SmartGrocery needs a few purchases to start predicting your needs. Let&apos;s set you up.
          </p>

          {/* Step progress */}
          <div className="flex items-start gap-0 mb-8">
            {[
              { n: 1, label: "Add first purchase", active: true },
              { n: 2, label: "Get first prediction", active: false },
              { n: 3, label: "Track your savings", active: false },
            ].map((step, i, arr) => (
              <div key={step.n} className="flex items-start flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    step.active ? "bg-white text-green-700 shadow-md" : "bg-green-600 text-green-200 border-2 border-green-400"
                  }`}>
                    {step.n}
                  </div>
                  <p className={`text-xs mt-2 text-center leading-tight ${step.active ? "text-white font-semibold" : "text-green-300"}`}>
                    {step.label}
                  </p>
                </div>
                {i < arr.length - 1 && (
                  <div className="h-0.5 bg-green-500 flex-1 mt-4 mx-1" />
                )}
              </div>
            ))}
          </div>

          <Link
            href="/add"
            className="inline-flex items-center gap-2 bg-white text-green-700 font-bold px-6 py-3 rounded-xl text-sm hover:bg-green-50 transition-colors"
          >
            <ShoppingCart className="w-4 h-4" /> Add Your First Purchase <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Locked stat cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Monthly Budget", value: `₹0 / ₹${(user?.monthly_budget ?? 8000).toLocaleString()}`, sub: "Start logging to track" },
            { label: "Waste Risk Alerts", value: "—", sub: "Add items to monitor" },
            { label: "Freshness Score", value: "—", sub: "Unlocks with data" },
          ].map((c) => (
            <div key={c.label} className="card opacity-50 relative overflow-hidden">
              <span className="absolute top-2 right-2 text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                Unlocks with data
              </span>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">{c.label}</p>
              <p className="text-xl font-bold text-gray-700">{c.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* What happens next */}
        <div className="card border-dashed border-gray-300 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">What unlocks as you log more?</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { emoji: "🛒", milestone: "5+ items", desc: "Waste risk predictions appear" },
              { emoji: "📊", milestone: "10+ items", desc: "Shopping list gets personalised" },
              { emoji: "💰", milestone: "1 month",  desc: "Overspend detection saves ₹500+/mo" },
            ].map((m) => (
              <div key={m.milestone}>
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
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  // Derive top 3 urgent items from demand predictions (waste high-risk + low stock days)
  const urgentWaste = waste.filter((w) => w.risk_level === "High" || w.risk_level === "Medium").slice(0, 2);

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting}{user ? `, ${user.name.split(" ")[0]}` : ""} ☀️
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{today}</p>
        </div>
        <button onClick={load} className="btn-secondary text-sm">Refresh</button>
      </div>

      {/* ⚡ Top actions today (moved from Insights) */}
      {urgentWaste.length > 0 && (
        <div className="card border-yellow-200 bg-yellow-50">
          <h2 className="text-sm font-semibold text-yellow-800 flex items-center gap-1.5 mb-3">
            <Zap className="w-4 h-4" /> Today&apos;s top actions
          </h2>
          <div className="space-y-2">
            {urgentWaste.map((w, i) => (
              <div key={w.item} className="flex items-start gap-3 bg-white rounded-xl p-3 border border-yellow-100">
                <span className="w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm">{w.item} — use before it spoils</p>
                  <p className="text-xs text-gray-500 mt-0.5">{w.recommendation} · {w.days_until_expiry} day{w.days_until_expiry !== 1 ? "s" : ""} left</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                  w.risk_level === "High" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                }`}>
                  {w.risk_level}
                </span>
              </div>
            ))}
          </div>
          <Link href="/insights" className="flex items-center gap-1 mt-3 text-xs text-green-700 font-semibold hover:underline">
            See all insights <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <BudgetBar spent={currentMonthSpend} budget={budget} />
        <div className="card flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-red-50 text-red-600 flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Waste Risk</p>
            <p className="text-2xl font-bold text-gray-800">{highRisk}</p>
            <p className="text-xs text-gray-400 mt-0.5">{highRisk === 0 ? "All items fresh" : `item${highRisk > 1 ? "s" : ""} need attention`}</p>
          </div>
        </div>
        <div className="card flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-purple-50 text-purple-600 flex-shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Freshness</p>
            <p className="text-2xl font-bold text-gray-800">{(avgConf * 100).toFixed(0)}%</p>
            <p className="text-xs text-gray-400 mt-0.5">avg across all items</p>
          </div>
        </div>
      </div>

      {/* Two-column: Recent purchases + Upcoming needs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Purchases</h2>
          <Table columns={purchaseCols as never} data={purchases.slice(0, 6) as never} emptyMessage="No purchases recorded yet." />
          {purchases.length > 6 && (
            <Link href="/add" className="flex items-center gap-1 mt-3 text-xs text-green-700 font-semibold hover:underline">
              View all {purchases.length} purchases <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Items at Waste Risk</h2>
          <Table columns={wasteCols as never} data={waste.filter((w) => w.risk_level !== "Low").slice(0, 6) as never} emptyMessage="No waste alerts — all items look fresh!" />
          {waste.filter((w) => w.risk_level !== "Low").length > 0 && (
            <Link href="/recommendations" className="flex items-center gap-1 mt-3 text-xs text-green-700 font-semibold hover:underline">
              View full shopping list <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>

      {/* Charts — collapsed by default */}
      <div className="card">
        <button
          onClick={() => setChartsOpen((o) => !o)}
          className="flex items-center justify-between w-full text-left"
        >
          <span className="text-sm font-semibold text-gray-700">Spending Trends</span>
          <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
            {chartsOpen ? "Hide charts" : "Show charts"}
            {chartsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        {chartsOpen && (
          <div className="mt-4 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <BarChartComponent
                data={spendData}
                xKey="category"
                bars={[{ key: "spend", color: "#22c55e", name: "Spend (₹)" }]}
                title="Spending by Category"
              />
              {(() => {
                const counts: Record<string, number> = { High: 0, Medium: 0, Low: 0 };
                waste.forEach((w) => { counts[w.risk_level]++; });
                const riskData = [
                  { level: "High",   count: counts.High,   fill: "#ef4444" },
                  { level: "Medium", count: counts.Medium, fill: "#f59e0b" },
                  { level: "Low",    count: counts.Low,    fill: "#22c55e" },
                ];
                return (
                  <BarChartComponent
                    data={riskData}
                    xKey="level"
                    bars={[{ key: "count", color: "#22c55e", name: "Items" }]}
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
                lines={[{ key: "spend", color: "#22c55e", name: "Monthly Spend (₹)" }]}
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
