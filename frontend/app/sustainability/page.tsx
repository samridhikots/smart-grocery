"use client";
import { useEffect, useState, useCallback } from "react";
import { api, SustainabilityResult, SustainabilityItem } from "@/services/api";
import { Leaf, RefreshCw, Recycle, Wind, Package } from "lucide-react";
import { BarChartComponent } from "@/components/Chart";

function EcoMeter({ value, max = 10, label }: { value: number; max?: number; label: string }) {
  const pct = (value / max) * 100;
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-gray-800">{value.toFixed(1)}/{max}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function SustainabilityPage() {
  const [report, setReport] = useState<SustainabilityResult | null>(null);
  const [items, setItems] = useState<SustainabilityItem[]>([]);
  const [months, setMonths] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userId] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [r, it] = await Promise.all([
        api.getSustainability(userId, months),
        api.getSustainabilityItems(),
      ]);
      setReport(r);
      setItems(it);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load sustainability data");
    } finally {
      setLoading(false);
    }
  }, [userId, months]);

  useEffect(() => { load(); }, [load]);

  const topPolluters = [...items]
    .sort((a, b) => b.co2_per_unit_g - a.co2_per_unit_g)
    .slice(0, 10)
    .map((it) => ({ item: it.item, co2: it.co2_per_unit_g / 1000 }));

  const ecoScoreData = items
    .sort((a, b) => b.eco_score - a.eco_score)
    .slice(0, 12)
    .map((it) => ({ item: it.item.length > 10 ? it.item.slice(0, 10) : it.item, score: it.eco_score }));

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
            <Leaf className="w-6 h-6 text-emerald-600" /> Sustainability Tracker
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Track your environmental footprint and get eco-friendly swap suggestions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={months}
            onChange={(e) => setMonths(parseInt(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value={1}>Last 1 month</option>
            <option value={3}>Last 3 months</option>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
          </select>
          <button onClick={load} className="btn-secondary flex items-center gap-1.5 text-sm">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {report && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card text-center">
              <Wind className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-800">{report.total_co2_kg_estimate.toFixed(1)}</p>
              <p className="text-xs text-gray-500 mt-0.5">kg CO₂ Estimated</p>
            </div>
            <div className="card text-center">
              <Leaf className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-800">{report.avg_eco_score.toFixed(1)}/10</p>
              <p className="text-xs text-gray-500 mt-0.5">Avg Eco Score</p>
            </div>
            <div className="card text-center">
              <Package className="w-6 h-6 text-purple-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-800">{report.plastic_packaging_pct.toFixed(0)}%</p>
              <p className="text-xs text-gray-500 mt-0.5">Plastic Packaging</p>
            </div>
            <div className="card text-center">
              <Recycle className="w-6 h-6 text-orange-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-800">{report.non_biodegradable_pct.toFixed(0)}%</p>
              <p className="text-xs text-gray-500 mt-0.5">Non-Biodegradable</p>
            </div>
          </div>

          {/* Eco metrics bar */}
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Environmental Metrics</h2>
            <EcoMeter value={report.avg_eco_score} label="Average Eco Score" />
            <EcoMeter value={10 - (report.plastic_packaging_pct / 10)} label="Packaging Score (lower plastic = better)" />
            <EcoMeter value={10 - (report.non_biodegradable_pct / 10)} label="Biodegradability Score" />
          </div>

          {/* Swap suggestions */}
          {report.swap_suggestions && report.swap_suggestions.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Eco-Friendly Swap Suggestions
              </h2>
              <div className="space-y-3">
                {report.swap_suggestions.map((swap, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-100">
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className="font-medium text-gray-800 text-sm">{swap.item}</p>
                        <p className="text-xs text-gray-500">Current</p>
                      </div>
                      <div className="text-green-600 font-bold px-2">→</div>
                      <div className="text-center">
                        <p className="font-medium text-green-700 text-sm">{swap.swap_to}</p>
                        <p className="text-xs text-gray-500">Recommended</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-green-700 font-semibold text-sm">{swap.co2_saving_pct}% less CO₂</p>
                      <p className="text-xs text-gray-500">{swap.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* CO2 chart */}
      {topPolluters.length > 0 && (
        <div className="card">
          <BarChartComponent
            data={topPolluters}
            xKey="item"
            bars={[{ key: "co2", color: "#6b7280", name: "CO₂ per unit (kg)" }]}
            title="CO₂ Footprint by Item (top 10)"
            height={300}
          />
        </div>
      )}

      {/* Eco score chart */}
      {ecoScoreData.length > 0 && (
        <div className="card">
          <BarChartComponent
            data={ecoScoreData}
            xKey="item"
            bars={[{ key: "score", color: "#22c55e", name: "Eco Score (0-10)" }]}
            title="Eco Scores by Item (higher = better)"
            height={300}
          />
        </div>
      )}

      {/* Full items table */}
      {items.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">All Items — Environmental Profile</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-gray-600 font-medium">Item</th>
                  <th className="text-left py-2 px-3 text-gray-600 font-medium">Category</th>
                  <th className="text-right py-2 px-3 text-gray-600 font-medium">Eco Score</th>
                  <th className="text-right py-2 px-3 text-gray-600 font-medium">CO₂/unit (g)</th>
                  <th className="text-center py-2 px-3 text-gray-600 font-medium">Plastic</th>
                  <th className="text-center py-2 px-3 text-gray-600 font-medium">Biodegradable</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.item} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium text-gray-800">{it.item}</td>
                    <td className="py-2 px-3 text-gray-600">{it.category}</td>
                    <td className="py-2 px-3 text-right">
                      <span className={`font-semibold ${it.eco_score >= 7 ? "text-green-600" : it.eco_score >= 4 ? "text-yellow-600" : "text-red-600"}`}>
                        {it.eco_score}/10
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-gray-700">{it.co2_per_unit_g}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={it.plastic_packaging ? "text-red-500" : "text-green-500"}>
                        {it.plastic_packaging ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={it.is_biodegradable ? "text-green-500" : "text-red-500"}>
                        {it.is_biodegradable ? "Yes" : "No"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
