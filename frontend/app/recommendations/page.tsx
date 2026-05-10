"use client";
import { useEffect, useState, useCallback } from "react";
import { api, DemandPrediction, WasteAlert, OptimizationResult, OptimizedItem } from "@/services/api";
import { BarChartComponent } from "@/components/Chart";
import Table from "@/components/Table";
import { TrendingUp, Trash2, DollarSign, Star, Copy, Share2, Check, HelpCircle } from "lucide-react";
import { RISK_COLORS, CATEGORIES } from "@/lib/constants";

type Tab = "demand" | "waste" | "budget";

type ReasonBadge = { label: string; color: string };

function explainDemand(pred: DemandPrediction): ReasonBadge[] {
  const reasons: ReasonBadge[] = [];
  if (pred.is_festival_month) reasons.push({ label: "Festival season boost", color: "bg-orange-100 text-orange-700" });
  if (pred.seasonal_factor > 1.2) reasons.push({ label: `${pred.seasonal_factor.toFixed(1)}× seasonal demand`, color: "bg-blue-100 text-blue-700" });
  if (pred.confidence >= 0.85) reasons.push({ label: "High confidence", color: "bg-green-100 text-green-700" });
  if (pred.days_until_next <= 3) reasons.push({ label: "Urgent — stock low", color: "bg-red-100 text-red-700" });
  if (pred.predicted_quantity_xgboost > pred.historical_avg * 1.15) reasons.push({ label: "Demand trending up", color: "bg-purple-100 text-purple-700" });
  if (pred.predicted_quantity_xgboost < pred.historical_avg * 0.85) reasons.push({ label: "Demand trending down", color: "bg-gray-100 text-gray-600" });
  return reasons;
}

function DemandCard({ pred }: { pred: DemandPrediction }) {
  const [showWhy, setShowWhy] = useState(false);
  const reasons = explainDemand(pred);
  const urgencyColor = pred.days_until_next <= 2 ? "text-red-600" : pred.days_until_next <= 5 ? "text-orange-500" : "text-gray-500";

  return (
    <div className="p-4 border border-gray-200 rounded-xl hover:border-green-300 transition-colors bg-white">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-800">{pred.item}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{pred.category}</span>
            {pred.brand && pred.brand !== "Local" && (
              <span className="text-xs text-gray-400">{pred.brand}</span>
            )}
          </div>
          <p className={`text-xs mt-1 font-medium ${urgencyColor}`}>{pred.urgency_message}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-gray-800">×{pred.recommended_quantity.toFixed(1)}</p>
          <p className="text-xs text-gray-500">₹{pred.estimated_cost_inr.toFixed(0)}</p>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="flex items-center gap-2 mt-2">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full" style={{ width: `${pred.confidence * 100}%` }} />
        </div>
        <span className="text-xs text-gray-400">{(pred.confidence * 100).toFixed(0)}%</span>
      </div>

      {/* Explain badges */}
      {reasons.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {reasons.map((r, i) => (
            <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.color}`}>{r.label}</span>
          ))}
        </div>
      )}

      {/* Why button */}
      <button
        onClick={() => setShowWhy(!showWhy)}
        className="flex items-center gap-1 mt-2 text-xs text-green-600 hover:text-green-800 font-medium"
      >
        <HelpCircle className="w-3.5 h-3.5" /> Why this recommendation?
      </button>

      {showWhy && (
        <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-gray-500">Historical avg</span>
            <span className="font-medium text-gray-700">×{pred.historical_avg.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">XGBoost prediction</span>
            <span className="font-medium text-gray-700">×{pred.predicted_quantity_xgboost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Seasonal factor</span>
            <span className="font-medium text-gray-700">{pred.seasonal_factor.toFixed(2)}×</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Festival month</span>
            <span className="font-medium text-gray-700">{pred.is_festival_month ? "Yes" : "No"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Unit price</span>
            <span className="font-medium text-gray-700">₹{pred.unit_price_inr.toFixed(0)}/unit</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Estimated cost</span>
            <span className="font-medium text-green-700">₹{pred.estimated_cost_inr.toFixed(0)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RecommendationsPage() {
  const [tab, setTab] = useState<Tab>("demand");
  const [demand, setDemand] = useState<DemandPrediction[]>([]);
  const [waste, setWaste] = useState<WasteAlert[]>([]);
  const [budget, setBudget] = useState<OptimizationResult | null>(null);
  const [budgetInput, setBudgetInput] = useState(2000);
  const [householdSize, setHouseholdSize] = useState(3);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const loadDemand = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await api.predictDemand();
      setDemand(d.predictions);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load demand predictions");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWaste = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const w = await api.predictWaste();
      setWaste(w.waste_alerts);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load waste predictions");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBudget = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const b = await api.optimizeBudget(
        budgetInput,
        householdSize,
        selectedCats.length > 0 ? selectedCats : undefined
      );
      setBudget(b);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to optimize budget");
    } finally {
      setLoading(false);
    }
  }, [budgetInput, householdSize, selectedCats]);

  useEffect(() => {
    if (tab === "demand") loadDemand();
    else if (tab === "waste") loadWaste();
    else loadBudget();
  }, [tab, loadDemand, loadWaste, loadBudget]);

  const topDemand = demand.slice(0, 12);
  const demandChartData = topDemand.map((d) => ({
    item: d.item.length > 8 ? d.item.slice(0, 8) : d.item,
    XGBoost: d.predicted_quantity_xgboost,
    Linear: d.predicted_quantity_linear,
    Historical: d.historical_avg,
  }));

  const wasteChartData = waste.slice(0, 10).map((w) => ({
    item: w.item.length > 8 ? w.item.slice(0, 8) : w.item,
    "TabNet Probability": parseFloat((w.waste_probability_tabnet * 100).toFixed(1)),
    "LR Probability": parseFloat((w.waste_probability_logistic * 100).toFixed(1)),
  }));

  const wasteCols = [
    { key: "item", header: "Item" },
    { key: "category", header: "Category" },
    { key: "risk_level", header: "Risk Level", render: (r: WasteAlert) => <span className={RISK_COLORS[r.risk_level]}>{r.risk_level}</span> },
    { key: "waste_probability_tabnet", header: "TabNet Probability", render: (r: WasteAlert) => `${(r.waste_probability_tabnet * 100).toFixed(1)}%` },
    { key: "days_until_expiry", header: "Days Left" },
    { key: "recommendation", header: "Action", render: (r: WasteAlert) => <span className="text-xs text-gray-600">{r.recommendation}</span> },
  ];

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "demand", label: "Demand Forecast", icon: TrendingUp },
    { id: "waste", label: "Waste Alerts", icon: Trash2 },
    { id: "budget", label: "Budget Optimizer", icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Star className="w-6 h-6 text-green-600" /> Recommendations
        </h1>
        <p className="text-gray-500 text-sm mt-1">ML-powered predictions and budget optimization.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id ? "bg-white shadow text-green-700" : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* Demand tab */}
          {tab === "demand" && (
            <div className="space-y-6">
              <div className="card">
                <BarChartComponent
                  data={demandChartData}
                  xKey="item"
                  bars={[
                    { key: "XGBoost", color: "#22c55e", name: "XGBoost Prediction" },
                    { key: "Linear", color: "#f59e0b", name: "Linear Prediction" },
                    { key: "Historical", color: "#3b82f6", name: "Historical Avg" },
                  ]}
                  title="Predicted vs Historical Purchase Quantities"
                  height={320}
                />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-3">All Item Predictions — with Explanations</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {demand.map((pred) => <DemandCard key={pred.item} pred={pred} />)}
                </div>
              </div>
            </div>
          )}

          {/* Waste tab */}
          {tab === "waste" && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                {["High", "Medium", "Low"].map((level) => {
                  const count = waste.filter((w) => w.risk_level === level).length;
                  return (
                    <div key={level} className="card text-center">
                      <p className="text-3xl font-bold text-gray-800">{count}</p>
                      <span className={level === "High" ? "badge-high" : level === "Medium" ? "badge-medium" : "badge-low"}>
                        {level} Risk
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="card">
                <BarChartComponent
                  data={wasteChartData}
                  xKey="item"
                  bars={[
                    { key: "TabNet Probability", color: "#ef4444", name: "TabNet %" },
                    { key: "LR Probability", color: "#f59e0b", name: "Logistic Reg %" },
                  ]}
                  title="Waste Probability by Item (top 10)"
                  height={300}
                />
              </div>
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Waste Risk Details</h2>
                <Table columns={wasteCols as never} data={waste as never} />
              </div>
            </div>
          )}

          {/* Budget tab */}
          {tab === "budget" && (
            <div className="space-y-6">
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Budget Parameters</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Budget (₹)</label>
                    <input
                      type="number"
                      value={budgetInput}
                      onChange={(e) => setBudgetInput(parseFloat(e.target.value) || 0)}
                      min={100}
                      step={100}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Household Size</label>
                    <input
                      type="number"
                      value={householdSize}
                      onChange={(e) => setHouseholdSize(parseInt(e.target.value) || 1)}
                      min={1}
                      max={10}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="flex items-end">
                    <button onClick={loadBudget} className="btn-primary w-full">Optimize</button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter Categories</label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() =>
                          setSelectedCats((prev) =>
                            prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
                          )
                        }
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                          selectedCats.includes(cat)
                            ? "bg-green-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {budget && (
                <>
                  {/* Share buttons */}
                  {(() => {
                    const listText = `🛒 My SmartGrocery List (Budget ₹${budget.budget.toFixed(0)})\n\n${
                      budget.items.map((it: OptimizedItem) => `• ${it.item} × ${it.quantity.toFixed(1)} — ₹${it.total_cost.toFixed(0)}`).join("\n")
                    }\n\nTotal: ₹${budget.total_cost.toFixed(0)}  |  Saved: ₹${budget.savings.toFixed(0)}\nPowered by SmartGrocery AI 🌿`;

                    const handleCopy = async () => {
                      await navigator.clipboard.writeText(listText);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    };

                    const handleWhatsApp = () => {
                      window.open(`https://wa.me/?text=${encodeURIComponent(listText)}`, "_blank");
                    };

                    return (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={handleCopy}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
                        >
                          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                          {copied ? "Copied!" : "Copy list"}
                        </button>
                        <button
                          onClick={handleWhatsApp}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[#25D366] hover:bg-[#1ebe5a] text-white transition-colors"
                        >
                          <Share2 className="w-4 h-4" /> Share on WhatsApp
                        </button>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="card text-center">
                      <p className="text-2xl font-bold text-gray-800">₹{budget.total_cost.toFixed(2)}</p>
                      <p className="text-xs text-gray-500 mt-1">Total Spent</p>
                    </div>
                    <div className="card text-center">
                      <p className="text-2xl font-bold text-green-600">₹{budget.savings.toFixed(2)}</p>
                      <p className="text-xs text-gray-500 mt-1">Savings</p>
                    </div>
                    <div className="card text-center">
                      <p className="text-2xl font-bold text-gray-800">{budget.items_count}</p>
                      <p className="text-xs text-gray-500 mt-1">Items Selected</p>
                    </div>
                    <div className="card text-center">
                      <p className="text-2xl font-bold text-purple-600">{(budget.optimization_score * 100).toFixed(0)}%</p>
                      <p className="text-xs text-gray-500 mt-1">Optimization Score</p>
                    </div>
                  </div>
                  <div className="card">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">Optimized Shopping List</h2>
                    <Table
                      columns={[
                        { key: "item", header: "Item" },
                        { key: "category", header: "Category" },
                        { key: "quantity", header: "Quantity", render: (r: OptimizedItem) => r.quantity.toFixed(2) },
                        { key: "unit_price", header: "Unit Price (₹)", render: (r: OptimizedItem) => `₹${r.unit_price.toFixed(2)}` },
                        { key: "total_cost", header: "Total (₹)", render: (r: OptimizedItem) => `₹${r.total_cost.toFixed(2)}` },
                        { key: "priority_score", header: "Priority" },
                        { key: "nutrition_score", header: "Nutrition", render: (r: OptimizedItem) => r.nutrition_score.toFixed(1) },
                      ] as never}
                      data={budget.items as never}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
