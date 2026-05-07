"use client";
import { useEffect, useState, useCallback } from "react";
import { api, DemandPrediction, WasteAlert, OptimizationResult, OptimizedItem } from "@/services/api";
import { LineChartComponent, BarChartComponent } from "@/components/Chart";
import Table from "@/components/Table";
import { TrendingUp, Trash2, DollarSign, Star } from "lucide-react";
import { RISK_COLORS, CATEGORIES } from "@/lib/constants";

type Tab = "demand" | "waste" | "budget";

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

  const demandCols = [
    { key: "item", header: "Item" },
    { key: "category", header: "Category" },
    { key: "recommended_quantity", header: "Recommended Qty", render: (r: DemandPrediction) => r.recommended_quantity.toFixed(2) },
    { key: "historical_avg", header: "Historical Avg", render: (r: DemandPrediction) => r.historical_avg.toFixed(2) },
    { key: "unit_price_inr", header: "Unit Price (₹)", render: (r: DemandPrediction) => `₹${r.unit_price_inr.toFixed(2)}` },
    { key: "confidence", header: "Confidence", render: (r: DemandPrediction) => (
      <div className="flex items-center gap-2">
        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full" style={{ width: `${r.confidence * 100}%` }} />
        </div>
        <span className="text-xs">{(r.confidence * 100).toFixed(0)}%</span>
      </div>
    )},
    { key: "days_until_next", header: "Buy In (days)" },
  ];

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
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">All Item Predictions</h2>
                <Table columns={demandCols as never} data={demand as never} />
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
