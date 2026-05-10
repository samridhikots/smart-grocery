"use client";
import { useEffect, useState, useCallback } from "react";
import { api, SustainabilityResult, SustainabilityItem } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { Leaf, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { BarChartComponent } from "@/components/Chart";

function EcoMeter({ value, max = 10, label }: { value: number; max?: number; label: string }) {
  const [barWidth, setBarWidth] = useState(0);
  const pct   = (value / max) * 100;
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";

  useEffect(() => {
    const t = setTimeout(() => setBarWidth(pct), 200);
    return () => clearTimeout(t);
  }, [pct]);

  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-gray-600 text-xs font-medium">{label}</span>
        <span className="font-bold text-gray-800 text-xs tabular-nums">{value.toFixed(1)}/{max}</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${barWidth}%`, transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
      </div>
    </div>
  );
}

/* ── Animated count-up for the ring score ── */
function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    let raf: number;
    const start = Date.now();
    const run = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      setVal(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(run);
      else setVal(target);
    };
    raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

export default function SustainabilityPage() {
  const { user }                         = useAuth();
  const [report,     setReport]          = useState<SustainabilityResult | null>(null);
  const [items,      setItems]           = useState<SustainabilityItem[]>([]);
  const [months,     setMonths]          = useState(1);
  const [loading,    setLoading]         = useState(true);
  const [error,      setError]           = useState("");
  const [detailOpen, setDetailOpen]      = useState(false);

  /* ── Animated SVG ring ── */
  const [ringOffset, setRingOffset] = useState(314);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setRingOffset(314); // reset animation on reload
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

  const ecoScore  = report?.avg_eco_score ?? 0;
  const ecoLabel  = ecoScore >= 8 ? "Excellent 🌟" : ecoScore >= 6 ? "Good 🟢" : ecoScore >= 4 ? "Fair 🟡" : "Needs work 🔴";
  const ecoColor  = ecoScore >= 8 ? "#15803d" : ecoScore >= 6 ? "#2d7a3a" : ecoScore >= 4 ? "#d97706" : "#dc2626";
  const ringColor = ecoScore >= 6 ? "#2d7a3a" : ecoScore >= 4 ? "#f59e0b" : "#ef4444";

  const animatedScore = useCountUp(ecoScore, 1100);

  /* animate the ring in once loading finishes */
  useEffect(() => {
    if (!loading && report) {
      const t = setTimeout(() => {
        setRingOffset(314 - (ecoScore / 10) * 314);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [loading, report, ecoScore]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded-xl" />
        <div className="h-56 bg-gray-200 rounded-2xl" />
        <div className="h-32 bg-gray-200 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Leaf className="w-6 h-6 text-emerald-600" /> Sustainability
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Environmental footprint for{" "}
            <span className="font-semibold text-gray-600">{user?.name ?? "your household"}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={months}
            onChange={(e) => setMonths(parseInt(e.target.value))}
            className="btn-secondary text-sm pr-8"
            style={{ paddingRight: "2rem" }}
          >
            <option value={1}>Last 1 month</option>
            <option value={3}>Last 3 months</option>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
          </select>
          <button onClick={load} className="btn-secondary text-sm">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm animate-fade-in">{error}</div>
      )}

      {report && (
        <>
          {/* Hero: animated eco score ring */}
          <div className="card flex flex-col sm:flex-row items-center gap-8 py-8 animate-slide-up">
            <div className="flex-shrink-0">
              <svg width="140" height="140" viewBox="0 0 120 120">
                {/* track */}
                <circle cx="60" cy="60" r="50" fill="none" stroke="#f0eeea" strokeWidth="12" />
                {/* animated fill */}
                <circle
                  cx="60" cy="60" r="50"
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="12"
                  strokeDasharray="314 314"
                  strokeDashoffset={ringOffset}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                  style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.4, 0, 0.2, 1)" }}
                />
                {/* animated text */}
                <text
                  x="60" y="55"
                  textAnchor="middle"
                  fontSize="24"
                  fontWeight="800"
                  fill="#1c1a18"
                >
                  {animatedScore.toFixed(1)}
                </text>
                <text x="60" y="72" textAnchor="middle" fontSize="11" fill="#9ca3af">/ 10</text>
              </svg>
            </div>

            <div>
              <p className="text-2xl font-bold mb-1" style={{ color: ecoColor }}>{ecoLabel}</p>
              <p className="text-sm text-gray-400 mb-4">Your household eco score for this period</p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full font-semibold border border-blue-100">
                  {report.total_co2_kg_estimate.toFixed(1)} kg CO₂
                </span>
                <span className={`text-xs px-3 py-1.5 rounded-full font-semibold border ${
                  report.plastic_packaging_pct < 30
                    ? "bg-green-50 text-green-700 border-green-100"
                    : "bg-orange-50 text-orange-700 border-orange-100"
                }`}>
                  {report.plastic_packaging_pct.toFixed(0)}% plastic packaging
                </span>
                <span className={`text-xs px-3 py-1.5 rounded-full font-semibold border ${
                  report.non_biodegradable_pct < 30
                    ? "bg-green-50 text-green-700 border-green-100"
                    : "bg-orange-50 text-orange-700 border-orange-100"
                }`}>
                  {report.non_biodegradable_pct.toFixed(0)}% non-biodegradable
                </span>
              </div>
            </div>
          </div>

          {/* Environmental metric bars */}
          <div className="card space-y-5 animate-slide-up stagger-1">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Environmental Metrics</h2>
            <EcoMeter value={report.avg_eco_score}                                         label="Average Eco Score" />
            <EcoMeter value={10 - (report.plastic_packaging_pct / 10)}                    label="Packaging Score (lower plastic = better)" />
            <EcoMeter value={10 - (report.non_biodegradable_pct / 10)}                    label="Biodegradability Score" />
          </div>

          {/* Swap suggestions */}
          {report.swap_suggestions?.length > 0 && (
            <div className="space-y-3 animate-slide-up stagger-2">
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">
                💡 Top swaps to reduce your footprint
              </h2>
              <p className="text-xs text-gray-400 -mt-1">Based on what you bought this period</p>
              {report.swap_suggestions.map((swap, i) => (
                <div
                  key={i}
                  className={`card card-interactive flex items-center gap-4 animate-slide-up stagger-${Math.min(i + 2, 8)}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="text-center flex-shrink-0">
                      <p className="font-semibold text-gray-800 text-sm">{swap.item}</p>
                      <p className="text-xs text-gray-400">Current</p>
                    </div>
                    <div className="font-bold text-lg flex-shrink-0" style={{ color: "var(--green-primary)" }}>→</div>
                    <div className="text-center flex-shrink-0">
                      <p className="font-semibold text-sm" style={{ color: "var(--green-primary)" }}>{swap.swap_to}</p>
                      <p className="text-xs text-gray-400">Swap to</p>
                    </div>
                    <div className="flex-1 min-w-0 hidden sm:block">
                      <p className="text-xs text-gray-500 truncate">{swap.reason}</p>
                    </div>
                  </div>
                  <span className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full font-bold flex-shrink-0 border border-green-200">
                    {swap.co2_saving_pct}% less CO₂
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Charts + table — collapsed */}
      {(topPolluters.length > 0 || ecoScoreData.length > 0 || items.length > 0) && (
        <div className="card animate-slide-up stagger-3">
          <button
            onClick={() => setDetailOpen((o) => !o)}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Full breakdown by item</span>
            <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--green-primary)" }}>
              {detailOpen ? "Hide" : "Show charts & table"}
              {detailOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </button>

          {detailOpen && (
            <div className="mt-6 space-y-6 animate-fade-in">
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
                  bars={[{ key: "score", color: "#2d7a3a", name: "Eco Score (0-10)" }]}
                  title="Eco Scores by Item (higher = better)"
                  height={280}
                />
              )}
              {items.length > 0 && (
                <>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">All Items — Environmental Profile</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: "1.5px solid #e5e0d8" }}>
                          {["Item", "Category", "Eco Score", "CO₂/unit (g)", "Plastic", "Biodegradable"].map((h) => (
                            <th key={h} className="text-left py-2 px-3 text-gray-400 font-bold text-xs uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it) => (
                          <tr key={it.item} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                            <td className="py-2 px-3 font-medium text-gray-800">{it.item}</td>
                            <td className="py-2 px-3 text-gray-500">{it.category}</td>
                            <td className="py-2 px-3">
                              <span className={`font-bold ${it.eco_score >= 7 ? "text-green-600" : it.eco_score >= 4 ? "text-yellow-600" : "text-red-600"}`}>
                                {it.eco_score}/10
                              </span>
                            </td>
                            <td className="py-2 px-3 text-gray-600">{it.co2_per_unit_g}</td>
                            <td className="py-2 px-3">
                              <span className={it.plastic_packaging ? "text-red-500 font-medium" : "text-green-500 font-medium"}>
                                {it.plastic_packaging ? "Yes" : "No"}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <span className={it.is_biodegradable ? "text-green-500 font-medium" : "text-red-500 font-medium"}>
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
