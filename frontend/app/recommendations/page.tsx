"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { api, DemandPrediction, WasteAlert, OptimizationResult, OptimizedItem } from "@/services/api";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import EmptyState from "@/components/EmptyState";
import Table from "@/components/Table";
import { ShoppingBag, Trash2, DollarSign, Copy, Share2, Check, HelpCircle, ArrowRight, X, RefreshCw, Sparkles } from "lucide-react";
import Pagination from "@/components/Pagination";
import XAIPanel from "@/components/XAIPanel";
import AIEnginePanel, { ModelCardData } from "@/components/AIEnginePanel";
import { RISK_COLORS, CATEGORIES } from "@/lib/constants";
import { useToast } from "@/contexts/ToastContext";

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

function DemandCard({ pred, urgencyGroup, onLogAsBought }: {
  pred: DemandPrediction;
  urgencyGroup: "today" | "week" | "later";
  onLogAsBought: (pred: DemandPrediction) => void;
}) {
  const [showWhy, setShowWhy] = useState(false);
  const reasons = explainDemand(pred);

  const borderColor =
    urgencyGroup === "today" ? "border-l-4 border-l-red-400" :
    urgencyGroup === "week"  ? "border-l-4 border-l-orange-400" :
                               "border-l-4 border-l-green-400";

  const badge =
    urgencyGroup === "today"
      ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold flex-shrink-0">Today</span>
      : urgencyGroup === "week"
      ? <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold flex-shrink-0">In {pred.days_until_next}d</span>
      : <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold flex-shrink-0">In {pred.days_until_next}d</span>;

  return (
    <div
      className={`flex items-center gap-3 p-4 bg-white rounded-xl transition-all duration-200 hover:shadow-md ${borderColor}`}
      style={{ border: "1.5px solid #E2E8F0" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="font-semibold text-gray-800">{pred.item}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{pred.category}</span>
          {pred.brand && pred.brand !== "Local" && (
            <span className="text-xs text-gray-400">{pred.brand}</span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
            pred.confidence >= 0.8 ? "bg-green-100 text-green-700" :
            pred.confidence >= 0.6 ? "bg-yellow-100 text-yellow-700" :
            "bg-gray-100 text-gray-500"
          }`}>
            <Sparkles className="w-2.5 h-2.5 inline mr-0.5" />
            {(pred.confidence * 100).toFixed(0)}% conf
          </span>
        </div>
        <p className="text-xs text-gray-500">
          Buy {pred.recommended_quantity.toFixed(1)} kg · ₹{pred.estimated_cost_inr.toFixed(0)}
        </p>

        {/* Explain badges */}
        {reasons.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {reasons.map((r, i) => (
              <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.color}`}>{r.label}</span>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowWhy(!showWhy)}
          className="flex items-center gap-1 mt-1.5 text-xs text-green-600 hover:text-green-800 font-medium"
        >
          <HelpCircle className="w-3 h-3" /> Why this?
        </button>

        {showWhy && pred.xai?.top_factors && (
          <XAIPanel factors={pred.xai.top_factors} />
        )}
        {showWhy && !pred.xai?.top_factors && (
          <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs space-y-1.5">
            {[
              ["Historical avg", `${pred.historical_avg.toFixed(2)} kg`],
              ["Seasonal factor", `${pred.seasonal_factor.toFixed(2)}×`],
              ["Festival month", pred.is_festival_month ? "Yes" : "No"],
              ["Confidence", `${(pred.confidence * 100).toFixed(0)}%`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-gray-500">{k}</span>
                <span className="font-medium text-gray-700">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        {badge}
        <button
          onClick={() => onLogAsBought(pred)}
          className="flex items-center gap-1 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-green-700 transition-colors whitespace-nowrap"
        >
          Log as bought <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function LogAsBoughtModal({
  pred,
  onClose,
  onSuccess,
}: {
  pred: DemandPrediction;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [quantity, setQuantity] = useState(pred.recommended_quantity.toFixed(1));
  const [price, setPrice] = useState(pred.estimated_cost_inr.toFixed(0));
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true, onClose);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quantity || !price) { setError("Quantity and price are required."); return; }
    setLoading(true);
    setError("");
    try {
      await api.addPurchase({
        item: pred.item,
        category: pred.category,
        quantity: parseFloat(quantity),
        price: parseFloat(price),
        purchase_date: purchaseDate,
      });
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to log purchase");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4" aria-hidden="true">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-modal-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 id="log-modal-title" className="font-bold text-gray-900">Log as bought</h2>
          <button onClick={onClose} aria-label="Close modal" className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <p className="font-semibold text-green-800">{pred.item}</p>
          <p className="text-xs text-green-600">{pred.category}</p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (kg / units) *</label>
            <input
              type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)}
              min="0.1" step="0.1"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹ total) *</label>
            <input
              type="number" value={price} onChange={(e) => setPrice(e.target.value)}
              min="1" step="1"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
            <input
              type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary justify-center">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 btn-primary justify-center disabled:opacity-60">
              {loading ? "Saving…" : "Confirm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RecommendationsPage() {
  const [tab, setTab] = useState<Tab>("demand");
  const [prevTab, setPrevTab] = useState<Tab>("demand");

  function switchTab(t: Tab) {
    setPrevTab(tab);
    setTab(t);
  }
  const [demand, setDemand] = useState<DemandPrediction[]>([]);
  const [waste, setWaste] = useState<WasteAlert[]>([]);
  const [budget, setBudget] = useState<OptimizationResult | null>(null);
  const [budgetInput, setBudgetInput] = useState(2000);
  const [householdSize, setHouseholdSize] = useState(3);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [logModal, setLogModal] = useState<DemandPrediction | null>(null);
  const { showToast } = useToast();
  const loadedTabs = useRef(new Set<Tab>());

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
    if (loadedTabs.current.has(tab)) return;
    loadedTabs.current.add(tab);
    if (tab === "demand") loadDemand();
    else if (tab === "waste") loadWaste();
    else loadBudget();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function handleLogSuccess() {
    const item = logModal?.item ?? "";
    setLogModal(null);
    showToast(`${item} logged successfully!`);
    loadedTabs.current.delete("demand");
    loadDemand();
  }

  // Pagination state
  const DEMAND_PAGE_SIZE = 10;
  const WASTE_PAGE_SIZE  = 10;
  const [todayPage,  setTodayPage]  = useState(1);
  const [weekPage,   setWeekPage]   = useState(1);
  const [laterPage,  setLaterPage]  = useState(1);
  const [wastePgIdx, setWastePgIdx] = useState(1);

  // Group demand predictions by urgency
  const todayItems  = demand.filter((d) => d.days_until_next <= 2);
  const weekItems   = demand.filter((d) => d.days_until_next > 2 && d.days_until_next <= 7);
  const laterItems  = demand.filter((d) => d.days_until_next > 7);

  const todayPaged  = todayItems.slice((todayPage - 1) * DEMAND_PAGE_SIZE, todayPage * DEMAND_PAGE_SIZE);
  const weekPaged   = weekItems.slice((weekPage  - 1) * DEMAND_PAGE_SIZE, weekPage  * DEMAND_PAGE_SIZE);
  const laterPaged  = laterItems.slice((laterPage - 1) * DEMAND_PAGE_SIZE, laterPage * DEMAND_PAGE_SIZE);
  const pagedWaste  = waste.slice((wastePgIdx - 1) * WASTE_PAGE_SIZE, wastePgIdx * WASTE_PAGE_SIZE);

  const wasteCols = [
    { key: "item", header: "Item" },
    { key: "category", header: "Category" },
    { key: "risk_level", header: "Risk Level", render: (r: WasteAlert) => <span className={RISK_COLORS[r.risk_level]}>{r.risk_level}</span> },
    { key: "waste_probability_tabnet", header: "TabNet Probability", render: (r: WasteAlert) => `${(r.waste_probability_tabnet * 100).toFixed(1)}%` },
    { key: "days_until_expiry", header: "Days Left" },
    { key: "recommendation", header: "Action", render: (r: WasteAlert) => <span className="text-xs text-gray-600">{r.recommendation}</span> },
  ];

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "demand", label: "Buy Soon",          icon: ShoppingBag },
    { id: "waste",  label: "Use Before Spoil",  icon: Trash2 },
    { id: "budget", label: "Optimise Budget",   icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      {logModal && (
        <LogAsBoughtModal
          pred={logModal}
          onClose={() => setLogModal(null)}
          onSuccess={handleLogSuccess}
        />
      )}

      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6" style={{ color: "var(--green-primary)" }} /> Shopping List
          </h1>
          <p className="text-gray-400 text-sm mt-1">Based on your household&apos;s patterns · Updated today</p>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 p-1 rounded-2xl w-fit animate-fade-in"
        style={{ background: "#F1F5F9" }}
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => switchTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              tab === id
                ? "bg-white shadow text-green-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center justify-between gap-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <span>{error}</span>
          <button
            onClick={() => { if (tab === "demand") loadDemand(); else if (tab === "waste") loadWaste(); else loadBudget(); }}
            className="flex items-center gap-1.5 font-semibold hover:underline flex-shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* Buy Soon tab — grouped by urgency */}
          {tab === "demand" && (
            <div className="space-y-6 animate-fade-in">
              {/* Summary strip */}
              {demand.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {todayItems.length > 0 && (
                    <span className="text-xs font-semibold bg-red-50 text-red-700 px-3.5 py-1.5 rounded-full border border-red-100">
                      🔴 {todayItems.length} — buy today
                    </span>
                  )}
                  {weekItems.length > 0 && (
                    <span className="text-xs font-semibold bg-orange-50 text-orange-700 px-3.5 py-1.5 rounded-full border border-orange-100">
                      🟡 {weekItems.length} — this week
                    </span>
                  )}
                  {laterItems.length > 0 && (
                    <span className="text-xs font-semibold bg-green-50 text-green-700 px-3.5 py-1.5 rounded-full border border-green-100">
                      🟢 {laterItems.length} — buy later
                    </span>
                  )}
                </div>
              )}

              {todayItems.length > 0 && (
                <div>
                  <h2 className="text-xs font-bold text-red-600 uppercase tracking-widest mb-3">Buy Today</h2>
                  <div className="space-y-2">
                    {todayPaged.map((pred, i) => (
                      <div key={pred.item} className={`animate-slide-up stagger-${Math.min(i + 1, 8)}`}>
                        <DemandCard pred={pred} urgencyGroup="today" onLogAsBought={setLogModal} />
                      </div>
                    ))}
                  </div>
                  <Pagination page={todayPage} totalPages={Math.ceil(todayItems.length / DEMAND_PAGE_SIZE)} onPageChange={setTodayPage} />
                </div>
              )}

              {weekItems.length > 0 && (
                <div>
                  <h2 className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">Buy This Week</h2>
                  <div className="space-y-2">
                    {weekPaged.map((pred, i) => (
                      <div key={pred.item} className={`animate-slide-up stagger-${Math.min(i + 1, 8)}`}>
                        <DemandCard pred={pred} urgencyGroup="week" onLogAsBought={setLogModal} />
                      </div>
                    ))}
                  </div>
                  <Pagination page={weekPage} totalPages={Math.ceil(weekItems.length / DEMAND_PAGE_SIZE)} onPageChange={setWeekPage} />
                </div>
              )}

              {laterItems.length > 0 && (
                <div>
                  <h2 className="text-xs font-bold text-green-600 uppercase tracking-widest mb-3">Buy Later</h2>
                  <div className="space-y-2 opacity-80">
                    {laterPaged.map((pred, i) => (
                      <div key={pred.item} className={`animate-slide-up stagger-${Math.min(i + 1, 8)}`}>
                        <DemandCard pred={pred} urgencyGroup="later" onLogAsBought={setLogModal} />
                      </div>
                    ))}
                  </div>
                  <Pagination page={laterPage} totalPages={Math.ceil(laterItems.length / DEMAND_PAGE_SIZE)} onPageChange={setLaterPage} />
                </div>
              )}

              {demand.length === 0 && (
                <EmptyState
                  icon={ShoppingBag}
                  title="No predictions yet"
                  message="Log a few grocery purchases and we'll start predicting what you need to restock and when."
                  ctaLabel="Add a purchase"
                  ctaHref="/add"
                />
              )}
            </div>
          )}

          {/* Use Before Spoil tab */}
          {tab === "waste" && waste.length === 0 && (
            <EmptyState
              icon={Trash2}
              title="Nothing to watch yet"
              message="Once you've logged purchases, we'll track expiry risk and alert you before items spoil."
              ctaLabel="Add a purchase"
              ctaHref="/add"
            />
          )}
          {tab === "waste" && waste.length > 0 && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-3 gap-4">
                {(["High", "Medium", "Low"] as const).map((level, i) => {
                  const count = waste.filter((w) => w.risk_level === level).length;
                  const styles: Record<string, { bg: string; text: string; border: string }> = {
                    High:   { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" },
                    Medium: { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
                    Low:    { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
                  };
                  return (
                    <div
                      key={level}
                      className={`card text-center animate-slide-up stagger-${i + 1}`}
                      style={{ background: styles[level].bg, borderColor: styles[level].border, color: styles[level].text }}
                    >
                      <p className="text-3xl font-bold tabular-nums">{count}</p>
                      <p className="text-xs font-bold uppercase tracking-widest mt-1">{level} Risk</p>
                    </div>
                  );
                })}
              </div>
              <div className="card animate-slide-up stagger-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
                  Items to Use Soon <span className="text-gray-300 font-normal normal-case tracking-normal">({waste.length} items)</span>
                </h2>
                <Table columns={wasteCols as never} data={pagedWaste as never} />
                <Pagination page={wastePgIdx} totalPages={Math.ceil(waste.length / WASTE_PAGE_SIZE)} onPageChange={setWastePgIdx} />
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
                    <button onClick={() => { loadedTabs.current.delete("budget"); loadBudget(); }} className="btn-primary">Optimize</button>
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

              {budget && (() => {
                const totalNeeded = budget.total_needed ?? budget.total_cost;
                const isOver = budget.is_over_budget ?? false;
                const gap = budget.budget_gap ?? 0;
                const usedPct = Math.min(100, (budget.total_cost / budget.budget) * 100);
                const deferred = budget.deferred_items ?? [];

                const listText = `My SmartGrocery List (Budget Rs.${budget.budget.toFixed(0)})\n\n${
                  budget.items.map((it: OptimizedItem) => `- ${it.item} x ${it.quantity.toFixed(1)} -- Rs.${it.total_cost.toFixed(0)}`).join("\n")
                }\n\nTotal: Rs.${budget.total_cost.toFixed(0)}  |  Remaining: Rs.${budget.savings.toFixed(0)}\nPowered by SmartGrocery AI`;

                const handleCopy = async () => {
                  await navigator.clipboard.writeText(listText);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                };
                const handleWhatsApp = () => {
                  window.open(`https://wa.me/?text=${encodeURIComponent(listText)}`, "_blank");
                };

                const urgencyBadge = (label?: string) => {
                  if (!label) return null;
                  const cls =
                    label === "Buy today" ? "bg-red-50 text-red-700 border border-red-200" :
                    label === "This week" ? "bg-orange-50 text-orange-700 border border-orange-200" :
                                           "bg-gray-50 text-gray-500 border border-gray-200";
                  return <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
                };

                return (
                  <>
                    {/* Budget overview */}
                    <div className={`card ${isOver ? "ring-1 ring-orange-200" : ""}`}>
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          {isOver ? (
                            <p className="text-sm font-semibold text-orange-700">
                              Your shopping needs <span className="text-base">₹{totalNeeded.toFixed(0)}</span> this period.
                              With ₹{budget.budget.toFixed(0)}, here&apos;s what to prioritize:
                            </p>
                          ) : (
                            <p className="text-sm font-semibold text-green-700">
                              Budget covers everything — ₹{budget.savings.toFixed(0)} left over after your full shopping list.
                            </p>
                          )}
                          {isOver && (
                            <p className="text-xs text-orange-500 mt-0.5">
                              ₹{gap.toFixed(0)} short — {deferred.length} item{deferred.length !== 1 ? "s" : ""} deferred to next trip
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-colors">
                            {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied ? "Copied!" : "Copy"}
                          </button>
                          <button onClick={handleWhatsApp} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#25D366] hover:bg-[#1ebe5a] text-white transition-colors">
                            <Share2 className="w-3.5 h-3.5" /> WhatsApp
                          </button>
                        </div>
                      </div>

                      {/* Budget bar */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>₹{budget.total_cost.toFixed(0)} used</span>
                          <span>₹{budget.budget.toFixed(0)} budget</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isOver ? "bg-orange-400" : "bg-green-500"}`}
                            style={{ width: `${usedPct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-400">{budget.items_count} of {budget.total_items_needed ?? budget.items_count} items covered</span>
                          {!isOver && <span className="text-green-600 font-medium">₹{budget.savings.toFixed(0)} remaining</span>}
                        </div>
                      </div>
                    </div>

                    {/* Prioritised shopping list */}
                    <div className="card">
                      <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">
                        Your Shopping List — Priority Order
                      </h2>
                      <div className="divide-y divide-gray-50">
                        {budget.items.map((it: OptimizedItem, i: number) => (
                          <div key={`${it.item}-${i}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                            <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center flex-shrink-0">
                              {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-gray-800 text-sm">{it.item}</span>
                                <span className="text-xs text-gray-400">{it.category}</span>
                                {it.is_perishable && (
                                  <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-full">Perishable</span>
                                )}
                                {it.status === "partial" && (
                                  <span className="text-[10px] font-semibold text-yellow-700 bg-yellow-50 border border-yellow-200 px-1.5 py-0.5 rounded-full">Partial</span>
                                )}
                              </div>
                              {it.note && <p className="text-xs text-gray-400 mt-0.5">{it.note}</p>}
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              {urgencyBadge(it.urgency_label)}
                              <div className="text-right">
                                <p className="text-sm font-bold text-gray-800">₹{it.total_cost.toFixed(0)}</p>
                                <p className="text-xs text-gray-400">{it.quantity.toFixed(1)} × ₹{it.unit_price.toFixed(0)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Deferred items */}
                    {deferred.length > 0 && (
                      <div className="card border border-dashed border-gray-200 bg-gray-50">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-3">
                          Deferred to Next Trip — {deferred.length} item{deferred.length !== 1 ? "s" : ""}
                        </h2>
                        <div className="divide-y divide-gray-100">
                          {deferred.map((it: OptimizedItem, i: number) => (
                            <div key={`${it.item}-d${i}`} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm text-gray-500 font-medium">{it.item}</span>
                                  <span className="text-xs text-gray-400">{it.category}</span>
                                </div>
                                {it.days_until_next && (
                                  <p className="text-xs text-gray-400 mt-0.5">Can wait ~{it.days_until_next} more days</p>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-sm font-semibold text-gray-400">₹{it.total_cost.toFixed(0)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-4 border-t border-gray-200 pt-3">
                          Total deferred: ₹{deferred.reduce((s: number, i: OptimizedItem) => s + i.total_cost, 0).toFixed(0)} — add to next week&apos;s budget
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </>
      )}

      {/* AI Engine Panel */}
      <AIEnginePanel
        title="AI Engine — Shopping Intelligence"
        models={[
          {
            name: "XGBoost", algorithm: "Gradient Boosted Trees",
            role: "Demand Forecasting (Primary)",
            metrics: { "R²": "0.87", "MAE": "0.23 kg" },
            features: 13, dataset: "Grocery Purchases (India)",
            inference_ms: "~8ms", modelKey: "xgboost",
          },
          {
            name: "Ridge Regression", algorithm: "L2 Regularized Linear",
            role: "Demand Baseline",
            metrics: { "R²": "0.71", "MAE": "0.41 kg" },
            features: 13, dataset: "Grocery Purchases (India)",
            inference_ms: "<2ms", modelKey: "ridge",
          },
          {
            name: "TabNet", algorithm: "Attention-based Neural Net",
            role: "Waste Prediction (Primary)",
            metrics: { "Accuracy": "74%", "AUC": "0.78" },
            features: 24, dataset: "Food Waste + Perishable Goods",
            inference_ms: "~15ms", modelKey: "tabnet",
          },
          {
            name: "Logistic Regression", algorithm: "L2 Linear Classifier",
            role: "Waste Baseline",
            metrics: { "Accuracy": "68%", "AUC": "0.72" },
            features: 24, dataset: "Food Waste Records",
            inference_ms: "<2ms", modelKey: "logistic",
          },
        ] as ModelCardData[]}
      />
    </div>
  );
}
