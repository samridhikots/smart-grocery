const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

// --- Types ---

export interface Purchase {
  id: number;
  user_id: number;
  item: string;
  category: string;
  quantity: number;
  price: number;
  purchase_date: string;
}

export interface PurchaseCreate {
  item: string;
  category: string;
  quantity: number;
  price: number;
  purchase_date: string;
  user_id?: number;
}

export interface DemandPrediction {
  item: string;
  category: string;
  brand: string;
  predicted_quantity_xgboost: number;
  predicted_quantity_linear: number;
  historical_avg: number;
  confidence: number;
  recommended_quantity: number;
  unit_price_inr: number;
  estimated_cost_inr: number;
  days_until_next: number;
  seasonal_factor: number;
  urgency_message: string;
}

export interface DemandResponse {
  predictions: DemandPrediction[];
  model_used: string;
  total_items: number;
}

export interface WasteAlert {
  item: string;
  category: string;
  brand: string;
  waste_probability_tabnet: number;
  waste_probability_logistic: number;
  risk_level: "High" | "Medium" | "Low";
  days_until_expiry: number;
  shelf_life_days: number;
  is_perishable: boolean;
  recommendation: string;
}

export interface WasteResponse {
  waste_alerts: WasteAlert[];
  high_risk_count: number;
}

export interface OptimizedItem {
  item: string;
  category: string;
  quantity: number;
  unit_price: number;
  total_cost: number;
  priority_score: number;
  nutrition_score: number;
}

export interface OptimizationResult {
  total_cost: number;
  budget: number;
  savings: number;
  optimization_score: number;
  items_count: number;
  items: OptimizedItem[];
  currency: string;
}

export interface WeekPlanDay {
  day: string;
  items: { item: string; category: string; quantity: number; estimated_price: number }[];
}

export interface WeekPlanResponse {
  week_plan: WeekPlanDay[];
  estimated_weekly_cost: number;
  household_size: number;
  shopping_days: string[];
  currency: string;
}

export interface ConfusionMatrix {
  tn: number;
  fp: number;
  fn: number;
  tp: number;
}

export interface ModelMetrics {
  split: string;
  mae?: number;
  rmse?: number;
  r2?: number;
  directional_accuracy?: number;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1?: number;
  roc_auc?: number;
  confusion_matrix?: ConfusionMatrix;
}

export interface ComparisonResult {
  demand_prediction: {
    task: string;
    metric_description: string;
    features_count: number;
    feature_names: string[];
    legacy: ModelMetrics & { name: string; type: string };
    modern: ModelMetrics & { name: string; type: string };
    winner: string;
    improvement: { mae_reduction: number; r2_gain: number };
  };
  waste_prediction: {
    task: string;
    metric_description: string;
    features_count: number;
    feature_names: string[];
    legacy: ModelMetrics & { name: string; type: string };
    modern: ModelMetrics & { name: string; type: string };
    winner: string;
    improvement: { f1_gain: number; auc_gain: number };
  };
  anomaly_detection: {
    task: string;
    model: string;
    trained: boolean;
    params: { n_estimators: number; contamination: number };
  };
  recommendation: {
    task: string;
    model: string;
    trained: boolean;
    top_rules: { antecedents: string[]; consequents: string[]; confidence: number; lift: number }[];
  };
  feature_importance: {
    demand_xgboost: Record<string, number>;
    waste_tabnet: Record<string, number>;
  };
}

// Insights
export interface Insight {
  type: string;
  severity: "critical" | "high" | "medium" | "info" | "low";
  title: string;
  message: string;
  priority: number;
  data?: Record<string, unknown>;
}

export interface InsightsResponse {
  user_id: number;
  insights: Insight[];
  total: number;
  generated_at: string;
}

// Overspending
export interface OverspendingResult {
  user_id: number;
  month: number;
  year: number;
  verdict: string;
  is_anomaly: boolean;
  monthly_spend: number;
  avg_3month: number;
  overspend_amount: number;
  message: string;
  history: { month: string; spend: number; is_anomaly: boolean }[];
}

// Recommendations (FP-Growth)
export interface RecommendationItem {
  item: string;
  confidence: number;
  lift: number;
  reason: string;
}

export interface RecommendationResult {
  basket: string[];
  recommendations: RecommendationItem[];
  top_rules: { antecedents: string[]; consequents: string[]; confidence: number; lift: number }[];
}

// Sustainability
export interface SustainabilityResult {
  user_id: number;
  months: number;
  plastic_packaging_pct: number;
  non_biodegradable_pct: number;
  avg_eco_score: number;
  total_co2_kg_estimate: number;
  swap_suggestions: { item: string; swap_to: string; co2_saving_pct: number; reason: string }[];
}

export interface SustainabilityItem {
  item: string;
  category: string;
  eco_score: number;
  co2_per_unit_g: number;
  plastic_packaging: boolean;
  is_biodegradable: boolean;
}

// --- API functions ---

export const api = {
  getPurchases: (limit = 50) =>
    request<Purchase[]>(`/purchases?limit=${limit}`),

  addPurchase: (data: PurchaseCreate) =>
    request<Purchase>("/add-purchase", { method: "POST", body: JSON.stringify(data) }),

  getItems: () =>
    request<{ item: string; category: string; avg_price: number; shelf_life: number; priority: number }[]>("/items"),

  predictDemand: () =>
    request<DemandResponse>("/predict-demand"),

  predictWaste: () =>
    request<WasteResponse>("/predict-waste"),

  optimizeBudget: (budget: number, household_size = 3, preferred_categories?: string[]) =>
    request<OptimizationResult>("/optimize-budget", {
      method: "POST",
      body: JSON.stringify({ budget, household_size, preferred_categories }),
    }),

  generatePlan: (household_size = 3) =>
    request<WeekPlanResponse>(`/generate-plan?household_size=${household_size}`),

  compareModels: () =>
    request<ComparisonResult>("/compare-models"),

  getInsights: (user_id = 1) =>
    request<InsightsResponse>(`/insights?user_id=${user_id}`),

  getOverspending: (user_id = 1, month?: number, year?: number) => {
    const params = new URLSearchParams({ user_id: String(user_id) });
    if (month) params.set("month", String(month));
    if (year) params.set("year", String(year));
    return request<OverspendingResult>(`/overspending?${params}`);
  },

  getRecommendations: (basket: string[]) =>
    request<RecommendationResult>("/recommendations", {
      method: "POST",
      body: JSON.stringify({ basket }),
    }),

  getSustainability: (user_id = 1, months = 1) =>
    request<SustainabilityResult>(`/sustainability?user_id=${user_id}&months=${months}`),

  getSustainabilityItems: () =>
    request<SustainabilityItem[]>("/sustainability/items"),
};
