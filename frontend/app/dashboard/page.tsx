"use client";
import { useEffect, useState, useCallback } from "react";
import { api, Purchase } from "@/services/api";
import { BarChartComponent } from "@/components/Chart";
import Table from "@/components/Table";
import { ShoppingCart, TrendingUp, Tag } from "lucide-react";
import { CATEGORY_COLORS } from "@/lib/constants";

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
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await api.getPurchases(50);
      setPurchases(p);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const catSpend: Record<string, number> = {};
  purchases.forEach((p) => {
    catSpend[p.category] = (catSpend[p.category] || 0) + p.price;
  });
  const spendData = Object.entries(catSpend).map(([category, spend]) => ({
    category,
    spend: parseFloat(spend.toFixed(2)),
  }));

  const totalSpend = purchases.reduce((a, p) => a + p.price, 0);
  const categories = Object.keys(catSpend).length;

  const purchaseCols = [
    { key: "purchase_date", header: "Date" },
    { key: "item", header: "Item" },
    {
      key: "category", header: "Category",
      render: (r: Purchase) => (
        <span className="px-2 py-0.5 rounded text-xs font-medium text-white" style={{ background: CATEGORY_COLORS[r.category] || "#6b7280" }}>
          {r.category}
        </span>
      ),
    },
    { key: "quantity", header: "Qty", render: (r: Purchase) => r.quantity.toFixed(2) },
    { key: "price", header: "Price (₹)", render: (r: Purchase) => `₹${r.price.toFixed(2)}` },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <button onClick={load} className="btn-secondary text-sm">Refresh</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={ShoppingCart} label="Total Purchases" value={purchases.length} sub="all time" color="bg-green-50 text-green-600" />
        <StatCard icon={TrendingUp} label="Total Spent" value={`₹${totalSpend.toFixed(0)}`} sub="all time" color="bg-blue-50 text-blue-600" />
        <StatCard icon={Tag} label="Categories" value={categories} sub="unique categories" color="bg-purple-50 text-purple-600" />
      </div>

      {spendData.length > 0 && (
        <div className="card">
          <BarChartComponent
            data={spendData}
            xKey="category"
            bars={[{ key: "spend", color: "#22c55e", name: "Spend (₹)" }]}
            title="Spending by Category"
          />
        </div>
      )}

      <div className="card">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Purchases</h2>
        <Table
          columns={purchaseCols as never}
          data={purchases as never}
          emptyMessage="No purchases yet — add your first one!"
        />
      </div>
    </div>
  );
}
