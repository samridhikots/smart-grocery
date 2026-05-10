"use client";
import { useEffect, useState, useCallback } from "react";
import { api, SustainabilityResult, SustainabilityItem } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { Leaf, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { BarChartComponent } from "@/components/Chart";

function EcoMeter({ value, max = 10, label }: { value: number; max?: number; label: string }) {
  const pct   = (value / max) * 100;
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
  const { user } = useAuth();
  const [report, setReport]         = useState<SustainabilityResult | null>(null);
  const [items, setItems]           = useState<SustainabilityItem[]>([]);
  const [months, setMonths]         = useState(1);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [detailOpen, setDetailOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [r, it] = await Promise.all([
        api.getSustainability(months),
        api.getSustainabilityItems(),
      ]);
      setReport(r);
      setItems(it);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load sustainability data");
    } finally {
      setLoading(false);
    }
  }, [months]);

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

  const ecoScore = report?.avg_eco_score ?? 0;
  const ecoLabel = ecoScore >= 8 ? "Excellent 🌟" : ecoScore >= 6 ? "Good 🟢" : ecoScore >= 4 ? "Fair 🟡" : "Needs work 🔴";
  const ecoColor = ecoScore >= 8 ? "text-green-600" : ecoScore >= 6 ? "text-green-500" : ecoScore >= 4 ? "text-yellow-500" : "text-red-500";
  const ringColor = ecoScore >= 6 ? "#22c55e" : ecoScore >= 4 ? "#f59e0b" : "#ef4444";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Leaf className="w-6 h-6 text-emerald-600" /> Sustainability
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Environmental footprint for{" "}
            <span className="font-medium text-gray-700">{user?.name ?? "your household"}</span>
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
          {/* Hero: single Eco Score ring */}
          <div className="card flex flex-col sm:flex-row items-center gap-8 py-8">
            {/* Ring */}
            <div className="flex-shrink-0">
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#f3f4f6" strokeWidth="12" />
                <circle
                  cx="60" cy="60" r="50"
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="12"
                  strokeDasharray={`${(ecoScore / 10) * 314} 314`}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                />
                <text x="60" y="55" textAnchor="middle" fontSize="22" fontWeight="800" fill="#1f2937">{ecoScore.toFixed(1)}</text>
                <text x="60" y="72" textAnchor="middle" fontSize="11" fill="#6b7280">/ 10</text>
              </svg>
            </div>
            <div>
              <p className={`text-2xl font-bold ${ecoColor} mb-1`}>{ecoLabel}</p>
              <p className="text-sm text-gray-500 mb-4">Your household eco score for the selected period</p>
              {/* Supporting metrics as small chips */}
              <div className="flex flex-wrap gap-2">
                <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
                  {report.total_co2_kg_estimate.toFixed(1)} kg CO₂
                </span>
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${report.plastic_packaging_pct < 30 ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"}`}>
                  {report.plastic_packaging_pct.toFixed(0)}% plastic packaging
                </span>
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${report.non_biodegradable_pct < 30 ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"}`}>
                  {report.non_biodegradable_pct.toFixed(0)}% non-biodegradable
                </span>
              </div>
            </div>
          </div>

          {/* Eco Score progress bars */}
          <div className="card space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Environmental Metrics</h2>
            <EcoMeter value={report.avg_eco_score} label="Average Eco Score" />
            <EcoMeter value={10 - (report.plastic_packaging_pct / 10)} label="Packaging Score (lower plastic = better)" />
            <EcoMeter value={10 - (report.non_biodegradable_pct / 10)} label="Biodegradability Score" />
          </div>

          {/* Swap suggestions — primary content, above the fold */}
          {report.swap_suggestions?.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-800">💡 Top swaps to reduce your footprint</h2>
              <p className="text-xs text-gray-500 -mt-1">Based on what you bought this period</p>
              {report.swap_suggestions.map((swap, i) => (
                <div key={i} className="card flex items-center gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="text-center flex-shrink-0">
                      <p className="font-semibold text-gray-800 text-sm">{swap.item}</p>
                      <p className="text-xs text-gray-400">Current</p>
                    </div>
                    <div className="text-green-600 font-bold text-lg">→</div>
                    <div className="text-center flex-shrink-0">
                      <p className="font-semibold text-green-700 text-sm">{swap.swap_to}</p>
                      <p className="text-xs text-gray-400">Swap to</p>
                    </div>
                    <div className="flex-1 min-w-0 hidden sm:block">
                      <p className="text-xs text-gray-500 truncate">{swap.reason}</p>
                    </div>
                  </div>
                  <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold flex-shrink-0">
                    {swap.co2_saving_pct}% less CO₂
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Charts + table collapsed by default */}
      {(topPolluters.length > 0 || ecoScoreData.length > 0 || items.length > 0) && (
        <div className="card">
          <button
            onClick={() => setDetailOpen((o) => !o)}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="text-sm font-semibold text-gray-700">Full breakdown by item</span>
            <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
              {detailOpen ? "Hide" : "Show charts & table"}
              {detailOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </button>

          {detailOpen && (
            <div className="mt-6 space-y-6">
              {topPolluters.length > 0 && (
                <BarChartComponent
                  data={topPolluters}
                  xKey="item"
                  bars={[{ key: "co2", color: "#6b7280", name: "CO₂ per unit (kg)" }]}
                  title="CO₂ Footprint by Item (top 10)"
                  height={280}
                />
              )}
              {ecoScoreData.length > 0 && (
                <BarChartComponent
                  data={ecoScoreData}
                  xKey="item"
                  bars={[{ key: "score", color: "#22c55e", name: "Eco Score (0-10)" }]}
                  title="Eco Scores by Item (higher = better)"
                  height={280}
                />
              )}
              {items.length > 0 && (
                <>
                  <h3 className="text-sm font-semibold text-gray-700">All Items — Environmental Profile</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs uppercase">Item</th>
                          <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs uppercase">Category</th>
                          <th className="text-right py-2 px-3 text-gray-500 font-medium text-xs uppercase">Eco Score</th>
                          <th className="text-right py-2 px-3 text-gray-500 font-medium text-xs uppercase">CO₂/unit (g)</th>
                          <th className="text-center py-2 px-3 text-gray-500 font-medium text-xs uppercase">Plastic</th>
                          <th className="text-center py-2 px-3 text-gray-500 font-medium text-xs uppercase">Biodegradable</th>
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
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
