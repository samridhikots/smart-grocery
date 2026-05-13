"use client";
import { useEffect, useState, useCallback } from "react";
import { api, ComparisonResult, ConfusionMatrix } from "@/services/api";
import { BarChartComponent, RadarChartComponent } from "@/components/Chart";
import { BarChart2, Trophy, TrendingDown, TrendingUp, RefreshCw, AlertTriangle } from "lucide-react";
import { BRAND_COLORS } from "@/lib/constants";

function MetricCard({ label, legacy, modern, higherIsBetter = true }: {
  label: string; legacy: number; modern: number; higherIsBetter?: boolean;
}) {
  const modernWins = higherIsBetter ? modern >= legacy : modern <= legacy;
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">{label}</p>
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <p className="text-xs text-amber-600 font-medium mb-1">Legacy</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(100, legacy * 100)}%` }} />
            </div>
            <span className="text-sm font-bold text-gray-700 w-12 text-right">{legacy.toFixed(3)}</span>
          </div>
        </div>
        <div className="flex-1">
          <p className="text-xs text-green-600 font-medium mb-1">Modern</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(100, modern * 100)}%` }} />
            </div>
            <span className="text-sm font-bold text-gray-700 w-12 text-right">{modern.toFixed(3)}</span>
          </div>
        </div>
      </div>
      {modernWins ? (
        <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
          <TrendingUp className="w-3 h-3" /> Modern wins by {Math.abs(modern - legacy).toFixed(3)}
        </p>
      ) : (
        <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
          <TrendingDown className="w-3 h-3" /> Legacy wins by {Math.abs(legacy - modern).toFixed(3)}
        </p>
      )}
    </div>
  );
}

function ConfusionMatrixDisplay({ cm, modelName }: { cm: ConfusionMatrix; modelName: string }) {
  const total = cm.tn + cm.fp + cm.fn + cm.tp;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{modelName}</p>
      <div className="grid grid-cols-2 gap-1 w-48">
        <div className="bg-green-50 border border-green-200 rounded p-2 text-center">
          <p className="text-lg font-bold text-green-700">{cm.tn}</p>
          <p className="text-xs text-gray-500">TN</p>
          <p className="text-xs text-gray-400">{total ? ((cm.tn / total) * 100).toFixed(1) : 0}%</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded p-2 text-center">
          <p className="text-lg font-bold text-red-600">{cm.fp}</p>
          <p className="text-xs text-gray-500">FP</p>
          <p className="text-xs text-gray-400">{total ? ((cm.fp / total) * 100).toFixed(1) : 0}%</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded p-2 text-center">
          <p className="text-lg font-bold text-orange-600">{cm.fn}</p>
          <p className="text-xs text-gray-500">FN</p>
          <p className="text-xs text-gray-400">{total ? ((cm.fn / total) * 100).toFixed(1) : 0}%</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-center">
          <p className="text-lg font-bold text-blue-700">{cm.tp}</p>
          <p className="text-xs text-gray-500">TP</p>
          <p className="text-xs text-gray-400">{total ? ((cm.tp / total) * 100).toFixed(1) : 0}%</p>
        </div>
      </div>
    </div>
  );
}

function FeatureImportanceBar({ name, score }: { name: string; score: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-24 sm:w-36 truncate flex-shrink-0" title={name}>{name}</span>
      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all"
          style={{ width: `${(score * 100).toFixed(1)}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-500 w-10 text-right">{(score * 100).toFixed(1)}%</span>
    </div>
  );
}

export default function ComparisonPage() {
  const [data, setData] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.compareModels();
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load comparison");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-52 bg-gray-200 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-28 bg-gray-200 rounded-2xl" />
          <div className="h-28 bg-gray-200 rounded-2xl" />
        </div>
        <div className="h-64 bg-gray-200 rounded-2xl" />
        <div className="h-64 bg-gray-200 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-8 animate-fade-in">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Failed to load comparison</h2>
        <p className="text-sm text-gray-500 mb-6 max-w-sm">{error}</p>
        <button onClick={load} className="btn-primary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { demand_prediction: dp, waste_prediction: wp, feature_importance: fi } = data;

  // Demand bar chart data
  const demandBarData = [
    { metric: "MAE", legacy: dp.legacy.mae ?? 0, modern: dp.modern.mae ?? 0 },
    { metric: "RMSE", legacy: dp.legacy.rmse ?? 0, modern: dp.modern.rmse ?? 0 },
  ];
  const demandHigherData = [
    { metric: "R² Score", legacy: Math.max(0, dp.legacy.r2 ?? 0), modern: Math.max(0, dp.modern.r2 ?? 0) },
    { metric: "Dir. Accuracy", legacy: dp.legacy.directional_accuracy ?? 0, modern: dp.modern.directional_accuracy ?? 0 },
  ];

  // Waste radar data
  const wasteRadarData = [
    { metric: "Accuracy", legacy: wp.legacy.accuracy ?? 0, modern: wp.modern.accuracy ?? 0 },
    { metric: "Precision", legacy: wp.legacy.precision ?? 0, modern: wp.modern.precision ?? 0 },
    { metric: "Recall", legacy: wp.legacy.recall ?? 0, modern: wp.modern.recall ?? 0 },
    { metric: "F1 Score", legacy: wp.legacy.f1 ?? 0, modern: wp.modern.f1 ?? 0 },
    { metric: "ROC-AUC", legacy: wp.legacy.roc_auc ?? 0, modern: wp.modern.roc_auc ?? 0 },
  ];

  // Waste bar chart
  const wasteBarData = wasteRadarData.map((d) => ({
    metric: d.metric,
    [wp.legacy.name]: d.legacy,
    [wp.modern.name]: d.modern,
  }));

  // Feature importance sorted
  const demandFI = Object.entries(fi.demand_xgboost || {}).sort(([, a], [, b]) => b - a);
  const wasteFI = Object.entries(fi.waste_tabnet || {}).sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-green-600" /> Model Comparison
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Side-by-side evaluation of legacy vs modern ML models on held-out test data.
        </p>
      </div>

      {/* Winner banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className="text-xs font-semibold text-gray-500 uppercase">Demand Prediction Winner</span>
          </div>
          <p className="text-xl font-bold text-green-700">{dp.winner}</p>
          <p className="text-sm text-gray-500 mt-1">{dp.task}</p>
          <div className="mt-2 flex gap-4 text-xs">
            <span className="text-green-600 font-medium">MAE -{dp.improvement.mae_reduction.toFixed(3)}</span>
            <span className="text-green-600 font-medium">R² +{dp.improvement.r2_gain.toFixed(3)}</span>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className="text-xs font-semibold text-gray-500 uppercase">Waste Prediction Winner</span>
          </div>
          <p className="text-xl font-bold text-purple-700">{wp.winner}</p>
          <p className="text-sm text-gray-500 mt-1">{wp.task}</p>
          <div className="mt-2 flex gap-4 text-xs">
            <span className="text-purple-600 font-medium">F1 +{wp.improvement.f1_gain.toFixed(3)}</span>
            <span className="text-purple-600 font-medium">AUC +{wp.improvement.auc_gain.toFixed(3)}</span>
          </div>
        </div>
      </div>

      {/* Demand Prediction Section */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">Demand Prediction Metrics</h2>
        <p className="text-sm text-gray-500 mb-4">{dp.metric_description}</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card space-y-3">
            <h3 className="font-semibold text-gray-700 text-sm">Error Metrics (lower = better)</h3>
            {demandBarData.map((d) => (
              <MetricCard key={d.metric} label={d.metric} legacy={d.legacy} modern={d.modern} higherIsBetter={false} />
            ))}
            {demandHigherData.map((d) => (
              <MetricCard key={d.metric} label={d.metric} legacy={d.legacy} modern={d.modern} higherIsBetter />
            ))}
          </div>
          <div className="card">
            <BarChartComponent
              data={[
                { model: dp.legacy.name.replace(" Regression", ""), ...{ MAE: dp.legacy.mae, RMSE: dp.legacy.rmse, R2: Math.max(0, dp.legacy.r2 ?? 0) } },
                { model: dp.modern.name.replace(" Regressor", ""), ...{ MAE: dp.modern.mae, RMSE: dp.modern.rmse, R2: Math.max(0, dp.modern.r2 ?? 0) } },
              ]}
              xKey="model"
              bars={[
                { key: "MAE", color: BRAND_COLORS.amber, name: "MAE" },
                { key: "RMSE", color: "#ef4444", name: "RMSE" },
                { key: "R2", color: "#22c55e", name: "R²" },
              ]}
              title="Demand Models — Error Comparison"
              height={280}
            />
          </div>
        </div>
      </div>

      {/* Waste Prediction Section */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">Waste Prediction Metrics</h2>
        <p className="text-sm text-gray-500 mb-4">{wp.metric_description}</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <RadarChartComponent
              data={wasteRadarData}
              title="Waste Models — Performance Radar"
              height={320}
            />
          </div>
          <div className="card">
            <BarChartComponent
              data={wasteBarData}
              xKey="metric"
              bars={[
                { key: wp.legacy.name, color: BRAND_COLORS.amber, name: "Logistic Reg" },
                { key: wp.modern.name, color: "#22c55e", name: "TabNet" },
              ]}
              title="Waste Models — Metric Comparison"
              height={320}
            />
          </div>
        </div>
      </div>

      {/* Confusion Matrices */}
      {(wp.legacy.confusion_matrix || wp.modern.confusion_matrix) && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Waste Model — Confusion Matrices</h2>
          <p className="text-xs text-gray-400 mb-4">TN = true negative, FP = false positive, FN = false negative, TP = true positive</p>
          <div className="flex flex-wrap gap-10">
            {wp.legacy.confusion_matrix && (
              <ConfusionMatrixDisplay cm={wp.legacy.confusion_matrix} modelName={wp.legacy.name} />
            )}
            {wp.modern.confusion_matrix && (
              <ConfusionMatrixDisplay cm={wp.modern.confusion_matrix} modelName={wp.modern.name} />
            )}
          </div>
        </div>
      )}

      {/* Feature Importance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">XGBoost Feature Importance (Demand)</h2>
          <div className="space-y-2.5">
            {demandFI.map(([name, score]) => (
              <FeatureImportanceBar key={name} name={name} score={score} />
            ))}
          </div>
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">TabNet Feature Importance (Waste)</h2>
          <div className="space-y-2.5">
            {wasteFI.map(([name, score]) => (
              <FeatureImportanceBar key={name} name={name} score={score} />
            ))}
          </div>
        </div>
      </div>

      {/* Full metrics table */}
      <div className="card overflow-x-auto">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Complete Metrics Summary</h2>
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="text-left border-b border-gray-100">
              <th className="pb-2 text-gray-500 font-medium whitespace-nowrap pr-4">Model</th>
              <th className="pb-2 text-gray-500 font-medium whitespace-nowrap pr-4">Type</th>
              <th className="pb-2 text-gray-500 font-medium whitespace-nowrap pr-4">Task</th>
              <th className="pb-2 text-gray-500 font-medium whitespace-nowrap pr-4">MAE / Acc</th>
              <th className="pb-2 text-gray-500 font-medium whitespace-nowrap pr-4">RMSE / F1</th>
              <th className="pb-2 text-gray-500 font-medium whitespace-nowrap">R² / AUC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {[
              { m: dp.legacy, task: "Demand", a: dp.legacy.mae, b: dp.legacy.rmse, c: dp.legacy.r2 },
              { m: dp.modern, task: "Demand", a: dp.modern.mae, b: dp.modern.rmse, c: dp.modern.r2 },
              { m: wp.legacy, task: "Waste", a: wp.legacy.accuracy, b: wp.legacy.f1, c: wp.legacy.roc_auc },
              { m: wp.modern, task: "Waste", a: wp.modern.accuracy, b: wp.modern.f1, c: wp.modern.roc_auc },
            ].map(({ m, task, a, b, c }) => (
              <tr key={m.name} className="hover:bg-gray-50">
                <td className="py-2.5 font-medium text-gray-800">{m.name}</td>
                <td className="py-2.5">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    m.type === "Modern" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                  }`}>{m.type}</span>
                </td>
                <td className="py-2.5 text-gray-500">{task}</td>
                <td className="py-2.5 font-mono">{(a ?? 0).toFixed(4)}</td>
                <td className="py-2.5 font-mono">{(b ?? 0).toFixed(4)}</td>
                <td className="py-2.5 font-mono">{(c ?? 0).toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
