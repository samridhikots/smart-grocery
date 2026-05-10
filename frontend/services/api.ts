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

// --- Auth API ---

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
};

// --- Data API ---

export const api = {
  getPurchases: (limit = 50) =>
    request<Purchase[]>(`/purchases?limit=${limit}`),

  addPurchase: (data: PurchaseCreate) =>
    request<Purchase>("/add-purchase", { method: "POST", body: JSON.stringify(data) }),

  getItems: () =>
    request<{ item: string; category: string; avg_price: number; shelf_life: number; priority: number }[]>("/items"),

  optimizeBudget: (budget: number, household_size = 3, preferred_categories?: string[]) =>
    request<OptimizationResult>("/optimize-budget", {
      method: "POST",
      body: JSON.stringify({ budget, household_size, preferred_categories }),
    }),
};
