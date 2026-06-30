"use client";
import { useEffect, useState } from "react";
import { api, SustainabilityResult, SustainabilityItem, MyItemsResponse } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { Leaf, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import Pagination from "@/components/Pagination";
import GreenCoinsWidget from "@/components/GreenCoinsWidget";
import AIEnginePanel, { ModelCardData } from "@/components/AIEnginePanel";
import { BarChartComponent } from "@/components/Chart";
import { BRAND_COLORS, ECO_SCORE } from "@/lib/constants";
import { useFetch } from "@/hooks/useFetch";
import { useCountUp } from "@/hooks/useCountUp";

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

type SortCol = "item" | "category" | "eco_score" | "co2_per_unit_g" | "plastic_packaging" | "is_biodegradable";

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
  return dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
}

function ItemsTable({ items }: { items: SustainabilityItem[] }) {
  const [sortCol, setSortCol] = useState<SortCol>("eco_score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("desc"); }
    setPage(1);
  }

  const sorted = [...items].sort((a, b) => {
    const mult = sortDir === "asc" ? 1 : -1;
    const av = a[sortCol], bv = b[sortCol];
    if (typeof av === "boolean") return (Number(av) - Number(bv)) * mult;
    if (typeof av === "number")  return (av - (bv as number)) * mult;
    return String(av).localeCompare(String(bv)) * mult;
  });
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const headers: { key: SortCol; label: string }[] = [
    { key: "item",              label: "Item" },
    { key: "category",         label: "Category" },
    { key: "eco_score",        label: "Eco Score" },
    { key: "co2_per_unit_g",   label: "CO₂/unit (g)" },
    { key: "plastic_packaging", label: "Plastic" },
    { key: "is_biodegradable", label: "Biodegradable" },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-label={`Items table, ${sorted.length} items`}>
        <thead>
          <tr style={{ borderBottom: "1.5px solid #E2E8F0" }}>
            {headers.map(({ key, label }) => (
              <th
                key={key}
                onClick={() => toggleSort(key)}
                className="text-left py-2 px-3 text-gray-400 font-bold text-xs uppercase tracking-wider cursor-pointer select-none hover:text-gray-600 transition-colors"
              >
                <span className="inline-flex items-center gap-1">
                  {label}
                  <SortIcon active={sortCol === key} dir={sortDir} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paged.map((it) => (
            <tr key={it.item} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
              <td className="py-2 px-3">
                <span className="font-medium text-gray-800">{it.item}</span>
                {it.is_estimated && (
                  <span className="ml-1 text-[10px] text-gray-400" title="Score estimated from category average">~est</span>
                )}
              </td>
              <td className="py-2 px-3 text-gray-500">{it.category}</td>
              <td className="py-2 px-3">
                <span className={`font-bold ${it.eco_score >= ECO_SCORE.good ? "text-green-600" : it.eco_score >= ECO_SCORE.fair ? "text-yellow-600" : "text-red-600"}`}>
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
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}

export default function SustainabilityPage() {
  const { user }                         = useAuth();
  const [months,     setMonths]          = useState(1);
  const [detailOpen, setDetailOpen]      = useState(false);
  const [ringOffset, setRingOffset]      = useState(314);

  const { data, loading, error, refresh: load } = useFetch(
    () => Promise.all([api.getSustainability(months), api.getMyItemEcoScores()]),
    [months]
  );

  const report    = data?.[0] as SustainabilityResult | undefined;
  const myData    = data?.[1] as MyItemsResponse | undefined;
  const items     = myData?.my_items ?? [];
  const topPicks  = myData?.top_picks ?? [];

  const topPolluters = [...items]
    .sort((a, b) => b.co2_per_unit_g - a.co2_per_unit_g)
    .slice(0, 10)
    .map((it) => ({ item: it.item, co2: it.co2_per_unit_g / 1000 }));

  const ecoScoreData = [...items]
    .sort((a, b) => b.eco_score - a.eco_score)
    .slice(0, 12)
    .map((it) => ({ item: it.item.length > 10 ? it.item.slice(0, 10) : it.item, score: it.eco_score }));

  const ecoScore  = report?.avg_eco_score ?? 0;
  const ecoLabel  = ecoScore >= ECO_SCORE.excellent ? "Excellent 🌟" : ecoScore >= ECO_SCORE.good ? "Good 🟢" : ecoScore >= ECO_SCORE.fair ? "Fair 🟡" : "Needs work 🔴";
  const ecoColor  = ecoScore >= ECO_SCORE.excellent ? "#15803d" : ecoScore >= ECO_SCORE.good ? BRAND_COLORS.green : ecoScore >= ECO_SCORE.fair ? "#d97706" : "#dc2626";
  const ringColor = ecoScore >= ECO_SCORE.good ? BRAND_COLORS.green : ecoScore >= ECO_SCORE.fair ? BRAND_COLORS.amber : BRAND_COLORS.red;

  const animatedScore = useCountUp(ecoScore, 1100);

  /* animate the ring in once loading finishes */
  useEffect(() => {
    if (!loading && report) {
      setRingOffset(314); // reset first
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

      {/* Green Coins Widget */}
      <GreenCoinsWidget />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Leaf className="w-6 h-6 text-emerald-600" /> Sustainability
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Environmental footprint for{" "}
            <span className="font-semibold text-gray-600">{user?.name ?? "your household"}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <select
            value={months}
            onChange={(e) => setMonths(parseInt(e.target.value))}
            className="btn-secondary text-sm"
          >
            <option value={1}>Last 1 month</option>
            <option value={3}>Last 3 months</option>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
          </select>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh sustainability data"
            className="btn-secondary text-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={load} className="flex items-center gap-1.5 font-semibold hover:underline flex-shrink-0">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {report && (
        <>
          {/* Hero: animated eco score ring */}
          <div className="card flex flex-col sm:flex-row items-center gap-8 py-8 animate-slide-up">
            <div className="flex-shrink-0 w-[140px]">
              <svg width="140" height="140" viewBox="0 0 120 120" aria-label={`Eco score: ${ecoScore.toFixed(1)} out of 10`} role="img">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#f0eeea" strokeWidth="12" />
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
                <text x="60" y="55" textAnchor="middle" fontSize="24" fontWeight="800" fill="#1c1a18">
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

      {/* Your purchased items — eco breakdown */}
      {items.length > 0 && (
        <div className="card animate-slide-up stagger-3">
          <button
            onClick={() => setDetailOpen((o) => !o)}
            className="flex items-center justify-between w-full text-left"
          >
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Your Items — Eco Breakdown</span>
              <span className="ml-2 text-xs text-gray-400 font-normal normal-case tracking-normal">
                ({items.length} item{items.length !== 1 ? "s" : ""} you&apos;ve purchased)
              </span>
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold flex-shrink-0" style={{ color: "var(--green-primary)" }}>
              {detailOpen ? "Hide" : "Show breakdown"}
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
                  title="CO₂ Footprint — Your Items"
                  height={240}
                />
              )}
              {ecoScoreData.length > 0 && (
                <BarChartComponent
                  data={ecoScoreData}
                  xKey="item"
                  bars={[{ key: "score", color: BRAND_COLORS.green, name: "Eco Score (0-10)" }]}
                  title="Eco Scores — Your Items (higher = greener)"
                  height={240}
                />
              )}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
                  Detailed Environmental Profile
                  <span className="ml-2 text-gray-300 font-normal normal-case tracking-normal">click any column to sort · ~estimated from category</span>
                </h3>
                <ItemsTable items={items} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top eco-friendly picks for your categories */}
      {topPicks.length > 0 && (
        <div className="card animate-slide-up stagger-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
            Top Eco-Friendly Picks for Your Categories
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Highest-rated sustainable items in the categories you shop — consider swapping in some of these.
          </p>
          <div className="space-y-2">
            {topPicks.map((pick, i) => (
              <div
                key={pick.item}
                className={`flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 animate-slide-up stagger-${Math.min(i + 1, 8)}`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: pick.eco_score >= 7 ? BRAND_COLORS.green : pick.eco_score >= 5 ? "#f59e0b" : "#ef4444" }}
                >
                  {pick.eco_score.toFixed(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm">{pick.item}</p>
                  <p className="text-xs text-gray-400">{pick.category} · {pick.co2_per_unit_g}g CO₂/unit</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {pick.plastic_packaging
                    ? <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full border border-orange-100">Plastic</span>
                    : <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-100">Plastic-free</span>}
                  {pick.is_biodegradable
                    ? <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-100">Biodegradable</span>
                    : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Engine Panel */}
      <AIEnginePanel
        title="AI Engine — Sustainability Tracker"
        models={[
          {
            name: "Sustainability Tracker", algorithm: "Rule-based Weighted Scoring",
            role: "Eco Impact Analysis",
            metrics: { "Eco score": "0–10", "CO₂ basis": "by category" },
            features: 5, dataset: "BigBasket + FAO CO₂ data",
            inference_ms: "<1ms", modelKey: "sustainability",
          },
        ] as ModelCardData[]}
      />

    </div>
  );
}
