const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("sg_token");
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string>),
  };
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

// --- Types ---

export interface User {
  id: number;
  name: string;
  email: string;
  household_size: number;
  monthly_budget: number;
  dietary_prefs: string;
  onboarding_complete: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

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
  is_festival_month: number;
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

export interface ConfusionMatrix { tn: number; fp: number; fn: number; tp: number }

export interface ModelMetrics {
  split: string;
  mae?: number; rmse?: number; r2?: number; directional_accuracy?: number;
  accuracy?: number; precision?: number; recall?: number; f1?: number;
  roc_auc?: number; confusion_matrix?: ConfusionMatrix;
}

export interface ComparisonResult {
  demand_prediction: {
    task: string; metric_description: string; features_count: number;
    feature_names: string[];
    legacy: ModelMetrics & { name: string; type: string };
    modern: ModelMetrics & { name: string; type: string };
    winner: string; improvement: { mae_reduction: number; r2_gain: number };
  };
  waste_prediction: {
    task: string; metric_description: string; features_count: number;
    feature_names: string[];
    legacy: ModelMetrics & { name: string; type: string };
    modern: ModelMetrics & { name: string; type: string };
    winner: string; improvement: { f1_gain: number; auc_gain: number };
  };
  anomaly_detection: {
    task: string; model: string; trained: boolean;
    params: { n_estimators: number; contamination: number };
  };
  recommendation: {
    task: string; model: string; trained: boolean;
    top_rules: { antecedents: string[]; consequents: string[]; confidence: number; lift: number }[];
  };
  feature_importance: { demand_xgboost: Record<string, number>; waste_tabnet: Record<string, number> };
}

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

export interface OverspendingResult {
  user_id: number;
  month: number; year: number; verdict: string;
  is_anomaly: boolean; monthly_spend: number; avg_3month: number;
  overspend_amount: number; message: string;
  history: { month: string; spend: number; is_anomaly: boolean }[];
}

export interface RecommendationItem {
  item: string; confidence: number; lift: number; reason: string;
}

export interface RecommendationResult {
  basket: string[];
  recommendations: RecommendationItem[];
  top_rules: { antecedents: string[]; consequents: string[]; confidence: number; lift: number }[];
}

export interface SustainabilityResult {
  user_id: number; months: number;
  plastic_packaging_pct: number; non_biodegradable_pct: number;
  avg_eco_score: number; total_co2_kg_estimate: number;
  swap_suggestions: { item: string; swap_to: string; co2_saving_pct: number; reason: string }[];
}

export interface SustainabilityItem {
  item: string; category: string;
  eco_score: number; co2_per_unit_g: number;
  plastic_packaging: boolean; is_biodegradable: boolean;
}

// --- Auth API (uses raw fetch so AuthContext can set token before calling api.*) ---

export const authApi = {
  signup: async (name: string, email: string, password: string): Promise<AuthResponse> => {
    const res = await fetch(`${BASE_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Signup failed" }));
      throw new Error(err.detail || "Signup failed");
    }
    return res.json();
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Invalid email or password" }));
      throw new Error(err.detail || "Login failed");
    }
    return res.json();
  },

  me: (): Promise<User> => request<User>("/auth/me"),

  onboarding: (data: { household_size: number; monthly_budget: number; dietary_prefs: string }): Promise<User> =>
    request<User>("/auth/onboarding", { method: "PUT", body: JSON.stringify(data) }),
};

// --- Data API ---

export const api = {
  getPurchases: (limit = 50) =>
    request<Purchase[]>(`/purchases?limit=${limit}`),

  addPurchase: (data: PurchaseCreate) =>
    request<Purchase>("/add-purchase", { method: "POST", body: JSON.stringify(data) }),

  deletePurchase: (id: number) =>
    fetch(`${BASE_URL}/purchases/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    }).then(res => { if (!res.ok && res.status !== 204) throw new Error("Delete failed"); }),

  getItems: () =>
    request<{ item: string; category: string; avg_price: number; shelf_life: number; priority: number }[]>("/items"),

  predictDemand: () => request<DemandResponse>("/predict-demand"),
  predictWaste: ()  => request<WasteResponse>("/predict-waste"),

  optimizeBudget: (budget: number, household_size = 3, preferred_categories?: string[]) =>
    request<OptimizationResult>("/optimize-budget", {
      method: "POST",
      body: JSON.stringify({ budget, household_size, preferred_categories }),
    }),

  generatePlan: (household_size = 3) =>
    request<WeekPlanResponse>(`/generate-plan?household_size=${household_size}`),

  compareModels: () => request<ComparisonResult>("/compare-models"),

  getInsights: () => request<InsightsResponse>("/insights"),

  getOverspending: (month?: number, year?: number) => {
    const params = new URLSearchParams();
    if (month) params.set("month", String(month));
    if (year)  params.set("year",  String(year));
    const qs = params.toString();
    return request<OverspendingResult>(`/overspending${qs ? `?${qs}` : ""}`);
  },

  getRecommendations: (basket: string[]) =>
    request<RecommendationResult>("/recommendations", {
      method: "POST",
      body: JSON.stringify({ basket }),
    }),

  getSustainability: (months = 1) =>
    request<SustainabilityResult>(`/sustainability?months=${months}`),

  getSustainabilityItems: () => request<SustainabilityItem[]>("/sustainability/items"),
};
