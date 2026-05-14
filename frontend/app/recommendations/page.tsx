"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { api, DemandPrediction, WasteAlert, OptimizationResult, OptimizedItem } from "@/services/api";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import EmptyState from "@/components/EmptyState";
import Table from "@/components/Table";
import { ShoppingBag, Trash2, DollarSign, Copy, Share2, Check, HelpCircle, ArrowRight, X, RefreshCw } from "lucide-react";
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
      style={{ border: "1.5px solid #e5e0d8" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="font-semibold text-gray-800">{pred.item}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{pred.category}</span>
          {pred.brand && pred.brand !== "Local" && (
            <span className="text-xs text-gray-400">{pred.brand}</span>
          )}
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

        {showWhy && (
          <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs space-y-1.5">
            {[
              ["Historical avg", `×${pred.historical_avg.toFixed(2)}`],
              ["XGBoost prediction", `×${pred.predicted_quantity_xgboost.toFixed(2)}`],
              ["Seasonal factor", `${pred.seasonal_factor.toFixed(2)}×`],
              ["Festival month", pred.is_festival_month ? "Yes" : "No"],
              ["Unit price", `₹${pred.unit_price_inr.toFixed(0)}/unit`],
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

  // Group demand predictions by urgency
  const todayItems  = demand.filter((d) => d.days_until_next <= 2);
  const weekItems   = demand.filter((d) => d.days_until_next > 2 && d.days_until_next <= 7);
  const laterItems  = demand.filter((d) => d.days_until_next > 7);

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
        style={{ background: "#ede8e0" }}
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
                    {todayItems.map((pred, i) => (
                      <div key={pred.item} className={`animate-slide-up stagger-${Math.min(i + 1, 8)}`}>
                        <DemandCard pred={pred} urgencyGroup="today" onLogAsBought={setLogModal} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {weekItems.length > 0 && (
                <div>
                  <h2 className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">Buy This Week</h2>
                  <div className="space-y-2">
                    {weekItems.map((pred, i) => (
                      <div key={pred.item} className={`animate-slide-up stagger-${Math.min(i + 1, 8)}`}>
                        <DemandCard pred={pred} urgencyGroup="week" onLogAsBought={setLogModal} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {laterItems.length > 0 && (
                <div>
                  <h2 className="text-xs font-bold text-green-600 uppercase tracking-widest mb-3">Buy Later</h2>
                  <div className="space-y-2 opacity-80">
                    {laterItems.map((pred, i) => (
                      <div key={pred.item} className={`animate-slide-up stagger-${Math.min(i + 1, 8)}`}>
                        <DemandCard pred={pred} urgencyGroup="later" onLogAsBought={setLogModal} />
                      </div>
                    ))}
                  </div>
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
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Items to Use Soon</h2>
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
