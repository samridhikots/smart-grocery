"use client";
import { useEffect, useState, useCallback } from "react";
import { api, Purchase, WasteAlert } from "@/services/api";
import { BarChartComponent } from "@/components/Chart";
import Table from "@/components/Table";
import { ShoppingCart, AlertTriangle, TrendingUp, DollarSign } from "lucide-react";
import { CATEGORY_COLORS, RISK_COLORS } from "@/lib/constants";

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

export default function Dashboard() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [waste, setWaste] = useState<WasteAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, w] = await Promise.all([api.getPurchases(50), api.predictWaste()]);
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
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <button onClick={load} className="btn-secondary text-sm">Refresh</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ShoppingCart} label="Total Purchases" value={purchases.length} sub="recorded transactions" color="bg-blue-50 text-blue-600" />
        <StatCard icon={DollarSign} label="Total Spent" value={`₹${totalSpend.toFixed(2)}`} sub="across all categories" color="bg-green-50 text-green-600" />
        <StatCard icon={AlertTriangle} label="High Waste Risk" value={highRisk} sub="items need attention" color="bg-red-50 text-red-600" />
        <StatCard icon={TrendingUp} label="Freshness Score" value={`${(avgConf * 100).toFixed(0)}%`} sub="avg across all items" color="bg-purple-50 text-purple-600" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <BarChartComponent
            data={spendData}
            xKey="category"
            bars={[{ key: "spend", color: "#22c55e", name: "Spend (₹)" }]}
            title="Spending by Category"
          />
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Waste Risk Distribution</h3>
          {(() => {
            const counts = { High: 0, Medium: 0, Low: 0 };
            waste.forEach((w) => { counts[w.risk_level]++; });
            const riskData = Object.entries(counts).map(([level, count]) => ({ level, count }));
            return (
              <BarChartComponent
                data={riskData}
                xKey="level"
                bars={[{ key: "count", color: "#ef4444", name: "Items" }]}
                height={250}
              />
            );
          })()}
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Purchases</h2>
          <Table columns={purchaseCols as never} data={purchases.slice(0, 10) as never} emptyMessage="No purchases recorded yet." />
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Waste Risk Alerts</h2>
          <Table columns={wasteCols as never} data={waste.filter((w) => w.risk_level !== "Low").slice(0, 10) as never} emptyMessage="No waste alerts." />
        </div>
      </div>
    </div>
  );
}
