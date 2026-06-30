"use client";
import { useState, useEffect } from "react";
import { X, CheckCircle, AlertCircle } from "lucide-react";

type Tab = "overview" | "architecture" | "tradeoffs";

interface ModelInfo {
  name:         string;
  tagline:      string;
  overview:     string;
  algorithm:    string;
  hyperparams:  { key: string; value: string }[];
  trainData:    string;
  features:     string;
  pros:         string[];
  cons:         string[];
}

const MODEL_INFO: Record<string, ModelInfo> = {
  ridge: {
    name:      "Ridge Regression",
    tagline:   "Demand Prediction Baseline",
    overview:  "A regularized linear regression model that adds L2 penalty to prevent overfitting. Used as the interpretable baseline for grocery demand forecasting.",
    algorithm: "Linear Regression + L2 Regularization (α = 1.0)",
    hyperparams: [{ key: "Alpha (λ)", value: "1.0" }, { key: "Solver", value: "auto" }, { key: "Max iter", value: "1000" }],
    trainData: "Synthetic grocery purchases (India-specific, ~10k rows)",
    features:  "13 demand features (seasonal, behavioral, price)",
    pros:      ["Highly interpretable coefficients", "Fast inference (<2ms)", "Handles multicollinearity well", "Stable predictions"],
    cons:      ["Cannot capture non-linear demand patterns", "Sensitive to feature scaling", "Weaker at extreme seasonal spikes"],
  },
  xgboost: {
    name:      "XGBoost",
    tagline:   "Demand Prediction (Primary)",
    overview:  "Gradient boosted ensemble that captures non-linear demand patterns. The primary model used for quantity forecasting and shopping recommendations.",
    algorithm: "Gradient Boosted Decision Trees (XGBoost)",
    hyperparams: [{ key: "n_estimators", value: "150" }, { key: "max_depth", value: "5" }, { key: "learning_rate", value: "0.05" }, { key: "subsample", value: "0.8" }],
    trainData: "Synthetic grocery purchases (India-specific, ~10k rows)",
    features:  "13 demand features incl. festival & monsoon flags",
    pros:      ["Captures non-linear & interaction effects", "Built-in feature importance", "Handles seasonality naturally", "R² ≈ 0.87"],
    cons:      ["Less interpretable than Ridge", "Slower training (~8s)", "Risk of overfitting if not tuned"],
  },
  logistic: {
    name:      "Logistic Regression",
    tagline:   "Waste Prediction Baseline",
    overview:  "Linear classifier for waste risk categories (Low/Medium/High). Provides well-calibrated probability estimates as a robust baseline.",
    algorithm: "Logistic Regression with L2 regularization (C = 1.0)",
    hyperparams: [{ key: "C (regularization)", value: "1.0" }, { key: "Solver", value: "lbfgs" }, { key: "Max iter", value: "1000" }],
    trainData: "Synthetic food waste records (~5k rows) + Kaggle enrichment",
    features:  "24 waste features (10 base + 10 engineered + 4 Indian context)",
    pros:      ["Well-calibrated probabilities", "Fast inference (<2ms)", "Interpretable coefficients"],
    cons:      ["Linear decision boundary only", "Misses complex feature interactions", "Lower AUC than TabNet"],
  },
  tabnet: {
    name:      "TabNet",
    tagline:   "Waste Prediction (Primary)",
    overview:  "Attention-based neural network specifically designed for tabular data. Dynamically selects which features matter most for each item's waste prediction.",
    algorithm: "Sequential Attention for Tabular Learning (TabNet)",
    hyperparams: [{ key: "N_steps", value: "3" }, { key: "N_d = N_a", value: "32" }, { key: "Gamma", value: "1.5" }, { key: "Epochs", value: "100" }],
    trainData: "Synthetic food waste + Perishable Goods Kaggle dataset",
    features:  "24 waste features (incl. monsoon humidity & summer heat flags)",
    pros:      ["Feature selection per-sample (attention)", "Handles Indian seasonal patterns", "Accuracy ≈ 74%, AUC ≈ 0.78", "Built-in explainability via attention weights"],
    cons:      ["Slower training (~15s+)", "Requires more tuning", "Heavier memory footprint"],
  },
  isolation_forest: {
    name:      "Isolation Forest",
    tagline:   "Anomaly Detection",
    overview:  "Unsupervised ensemble that detects unusual spending patterns without needing labeled \"anomaly\" examples. Flags months where spending deviates significantly.",
    algorithm: "Isolation Forest (ensemble of random isolation trees)",
    hyperparams: [{ key: "n_estimators", value: "100" }, { key: "contamination", value: "0.10" }, { key: "max_features", value: "1.0" }],
    trainData: "User purchase history (rolling monthly aggregates)",
    features:  "Monthly spend, category mix, item count",
    pros:      ["No labeled anomalies needed", "Scales to high dimensions", "Fast scoring (<5ms)"],
    cons:      ["Contamination threshold requires tuning", "Black-box decision boundary", "Can flag valid seasonal spikes"],
  },
  fpgrowth: {
    name:      "FP-Growth",
    tagline:   "Smart Recommendations",
    overview:  "Frequent Pattern mining algorithm that discovers association rules between grocery items. Powers the \"people who buy X also buy Y\" recommendations.",
    algorithm: "FP-Growth (Frequent Pattern tree mining)",
    hyperparams: [{ key: "Min support", value: "1%" }, { key: "Min confidence", value: "20%" }, { key: "Min lift", value: "1.0" }],
    trainData: "Grocery transactions + Kaggle groceries.csv",
    features:  "Item co-occurrence patterns in baskets",
    pros:      ["Interpretable rules (if X → then Y)", "Efficient on sparse transaction data", "No training labels needed"],
    cons:      ["Static patterns (no real-time learning)", "Exponential rule count at low support", "Doesn't capture quantities"],
  },
  sustainability: {
    name:      "Sustainability Tracker",
    tagline:   "Eco Impact Analysis",
    overview:  "Rule-based scoring system that quantifies the environmental impact of grocery purchases. Assigns eco-scores, estimates CO₂ footprint, and suggests greener swaps.",
    algorithm: "Rule-based Weighted Scoring + CO₂ Coefficient Lookup",
    hyperparams: [{ key: "Eco score range", value: "0 – 10" }, { key: "CO₂ basis", value: "per kg category" }, { key: "Packaging weight", value: "30%" }],
    trainData: "BigBasket catalog + domain knowledge (FSSAI, FAO data)",
    features:  "Packaging type, biodegradability, category CO₂ coefficient, origin",
    pros:      ["Fully explainable scoring", "No training data required", "Domain-specific Indian context"],
    cons:      ["Requires manual eco-score curation", "CO₂ estimates are approximations", "Cannot learn from user feedback"],
  },
};

export default function ModelInfoModal({ modelKey, onClose }: { modelKey: string; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const info = MODEL_INFO[modelKey];

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!info) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-slide-up overflow-hidden"
        style={{ border: "1.5px solid #e5e0d8" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{info.name}</h2>
            <p className="text-xs text-green-600 font-semibold mt-0.5">{info.tagline}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pb-3">
          {(["overview", "architecture", "tradeoffs"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                tab === t ? "bg-green-100 text-green-700" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {t === "tradeoffs" ? "Pros & Cons" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-5 pb-5 max-h-96 overflow-y-auto">
          {tab === "overview" && (
            <div className="space-y-3 animate-fade-in">
              <p className="text-sm text-gray-700 leading-relaxed">{info.overview}</p>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Training data</p>
                  <p className="text-xs font-medium text-gray-700">{info.trainData}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Features</p>
                  <p className="text-xs font-medium text-gray-700">{info.features}</p>
                </div>
              </div>
            </div>
          )}

          {tab === "architecture" && (
            <div className="space-y-3 animate-fade-in">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">Algorithm</p>
                <p className="text-sm font-semibold text-gray-800">{info.algorithm}</p>
              </div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mt-4">Hyperparameters</p>
              <div className="space-y-1">
                {info.hyperparams.map(({ key, value }) => (
                  <div key={key} className="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span className="text-sm text-gray-600">{key}</span>
                    <span className="text-sm font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded font-mono">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "tradeoffs" && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-green-600 mb-2">Pros</p>
                <ul className="space-y-1.5">
                  {info.pros.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-orange-500 mb-2">Cons</p>
                <ul className="space-y-1.5">
                  {info.cons.map((c) => (
                    <li key={c} className="flex items-start gap-2 text-sm text-gray-700">
                      <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
