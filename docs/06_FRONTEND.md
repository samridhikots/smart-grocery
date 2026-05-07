# Frontend Documentation
## Smart Grocery Management System — Next.js

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Routing Structure](#2-routing-structure)
3. [Pages](#3-pages)
4. [Components](#4-components)
5. [API Service Layer](#5-api-service-layer)
6. [Constants and Configuration](#6-constants-and-configuration)
7. [Styling System](#7-styling-system)
8. [Data Flow and State Management](#8-data-flow-and-state-management)
9. [Chart Components](#9-chart-components)
10. [TypeScript Types](#10-typescript-types)
11. [Build and Development](#11-build-and-development)

---

## 1. Architecture Overview

```
frontend/
├── app/                    ← Next.js App Router (pages + layouts)
│   ├── layout.tsx          ← Root layout wrapping all pages
│   ├── globals.css         ← Tailwind base + custom components
│   ├── page.tsx            ← Landing page (/)
│   ├── dashboard/          ← /dashboard
│   ├── add/                ← /add
│   ├── recommendations/    ← /recommendations
│   └── comparison/         ← /comparison
├── components/             ← Shared React components
│   ├── Navbar.tsx
│   ├── Chart.tsx           ← Recharts wrapper components
│   ├── Table.tsx           ← Generic typed table
│   └── Form.tsx            ← Purchase input form
├── services/
│   └── api.ts              ← Typed HTTP client (all API calls)
└── lib/
    └── constants.ts        ← Item lists, category colors, constants
```

**Framework:** Next.js 14 with App Router  
**Language:** TypeScript (strict mode)  
**Styling:** Tailwind CSS 3  
**Charts:** Recharts 2  
**Icons:** Lucide React  
**HTTP Client:** Native `fetch` with typed wrappers

---

## 2. Routing Structure

| URL | File | Type | Description |
|-----|------|------|-------------|
| `/` | `app/page.tsx` | Static | Landing page |
| `/dashboard` | `app/dashboard/page.tsx` | Client | Live dashboard with charts |
| `/add` | `app/add/page.tsx` | Client | Purchase recording form |
| `/recommendations` | `app/recommendations/page.tsx` | Client | Demand, waste, budget tabs |
| `/comparison` | `app/comparison/page.tsx` | Client | Model comparison charts |

All data-fetching pages are **client components** (`"use client"`) because they call the backend API from the browser and update state reactively.

The landing page (`/`) is a **static server component** — it contains no dynamic data and renders at build time.

### Root Layout

```tsx
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Navbar />                                    ← Persistent navigation
        <main className="max-w-7xl mx-auto px-4 py-8">
          {children}                                  ← Page content
        </main>
      </body>
    </html>
  );
}
```

The Navbar is rendered once in the layout and persists across all route transitions.

---

## 3. Pages

### Landing Page (`app/page.tsx`)

**Type:** Static Server Component  
**Purpose:** Project overview, feature showcase, dataset summary

**Sections:**
1. Hero banner with project title, tagline, and CTA buttons
2. Feature cards grid (4 features: Demand Prediction, Waste Alerts, Budget Optimizer, Model Comparison)
3. Dataset overview cards (6 datasets with row counts and purpose)
4. ML model architecture summary (legacy vs modern pairs)

No API calls — fully static.

---

### Dashboard (`app/dashboard/page.tsx`)

**Type:** Client Component  
**APIs called:** `GET /api/purchases`, `GET /api/predict-waste`

**State:**
```typescript
const [purchases, setPurchases] = useState<Purchase[]>([]);
const [waste, setWaste] = useState<WasteAlert[]>([]);
const [loading, setLoading] = useState(true);
```

**Sections:**

1. **Stats Row (4 cards)**
   - Total purchases recorded
   - Total amount spent ($)
   - High-waste risk item count
   - Average freshness score (1 - waste_probability_rf)

2. **Charts Row (2 charts)**
   - Bar chart: Spending by category
   - Bar chart: Waste risk distribution (High / Medium / Low counts)

3. **Tables Row (2 tables)**
   - Recent purchases (last 10, with category color badge)
   - Waste risk alerts (filtered to non-Low risk items)

**Refresh button:** Re-fetches both APIs and updates all charts/tables.

---

### Add Purchase (`app/add/page.tsx`)

**Type:** Client Component  
**APIs called:** `POST /api/add-purchase` (via Form), `GET /api/purchases`

**Layout:**
1. Purchase form (rendered via `<PurchaseForm onSuccess={fetchPurchases} />`)
2. Recent purchases table (live-updates after each submission)

The `onSuccess` callback triggers a re-fetch of the purchases table so users immediately see their new entry.

---

### Recommendations (`app/recommendations/page.tsx`)

**Type:** Client Component  
**APIs called (tab-dependent):**
- Demand tab: `GET /api/predict-demand`
- Waste tab: `GET /api/predict-waste`
- Budget tab: `POST /api/optimize-budget`

**Tab System:**
```typescript
type Tab = "demand" | "waste" | "budget";
const [tab, setTab] = useState<Tab>("demand");
```

API calls are triggered by tab switches via `useEffect`:
```typescript
useEffect(() => {
  if (tab === "demand") loadDemand();
  else if (tab === "waste") loadWaste();
  else loadBudget();
}, [tab]);
```

#### Demand Tab

- Bar chart: XGBoost vs Linear vs Historical quantities per item
- Table: All 30 items with predicted quantities, confidence bars, unit price, days-until-next

**Confidence bar component:**
```tsx
<div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
  <div className="h-full bg-green-500" style={{ width: `${confidence * 100}%` }} />
</div>
```

#### Waste Tab

- 3 stat cards: High / Medium / Low risk item counts
- Bar chart: RF vs Logistic waste probability per top-10 items
- Full table: all items with risk badge, probability, days left, recommendation text

#### Budget Tab

- Form inputs: Budget ($), Household size, Category filter toggles
- "Optimize" button triggers `POST /api/optimize-budget`
- Results:
  - 4 stat cards (total spent, savings, items count, optimization score)
  - Sorted shopping list table

---

### Model Comparison (`app/comparison/page.tsx`)

**Type:** Client Component  
**APIs called:** `GET /api/compare-models`

**Sections:**

1. **Winner Banners (2 cards)**
   - Demand prediction winner + improvement metrics
   - Waste prediction winner + improvement metrics

2. **Demand Prediction Section**
   - `MetricCard` components showing legacy vs modern side-by-side bars for MAE, RMSE, R², Directional Accuracy
   - Bar chart: MAE, RMSE, R² for both models

3. **Waste Prediction Section**
   - Radar chart: 5-dimensional comparison (Accuracy, Precision, Recall, F1, AUC)
   - Bar chart: per-metric comparison for both waste models

4. **Feature Importance Section (2 columns)**
   - XGBoost feature importance bars (demand)
   - Random Forest feature importance bars (waste)

5. **Complete Metrics Table**
   - All 4 models in one table with all metrics

**`MetricCard` component:**
```tsx
function MetricCard({ label, legacy, modern, higherIsBetter }) {
  // Shows two progress bars (amber for legacy, green for modern)
  // Shows improvement/regression direction arrow
}
```

---

## 4. Components

### Navbar.tsx

```tsx
const links = [
  { href: "/",                label: "Home",             icon: ShoppingCart },
  { href: "/dashboard",       label: "Dashboard",        icon: LayoutDashboard },
  { href: "/add",             label: "Add Purchase",     icon: PlusCircle },
  { href: "/recommendations", label: "Recommendations",  icon: Star },
  { href: "/comparison",      label: "Model Comparison", icon: BarChart2 },
];
```

Uses `usePathname()` to highlight the active route with `bg-green-100 text-green-700` styling.  
Icons hidden on mobile (`hidden md:inline`), only icon shown on small screens.

### Table.tsx

A **generic, fully-typed** table component:

```tsx
interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;  // optional custom renderer
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
}

export default function Table<T extends Record<string, unknown>>({ ... })
```

Usage examples:
```tsx
// Simple
<Table columns={[{ key: "item", header: "Item" }]} data={purchases} />

// With custom renderer
<Table columns={[{
  key: "risk_level",
  header: "Risk",
  render: (r: WasteAlert) => <span className={RISK_COLORS[r.risk_level]}>{r.risk_level}</span>
}]} data={waste} />
```

Renders a styled table with:
- Gray header row
- Hover effect on rows
- Empty state message when `data.length === 0`
- Horizontal scroll for overflow

### Form.tsx (PurchaseForm)

A controlled form for adding purchase records:

**State:**
```typescript
interface FormState {
  item: string;
  category: string;
  quantity: string;   // string to work with input[type=number]
  price: string;
  purchase_date: string;
}
```

**Cascading select logic:**
When `category` changes, `item` is reset to empty and the item dropdown repopulates from `ITEMS_BY_CATEGORY[category]`.

**Submission flow:**
1. Validate non-empty fields client-side
2. Parse quantity/price to float
3. `api.addPurchase(data)` → POST to backend
4. Show success/error message
5. On success: reset form, call `onSuccess()` callback

### Chart.tsx

Three chart wrapper components built on Recharts:

**`BarChartComponent`** — For comparing discrete metrics across items/models:
```tsx
<BarChartComponent
  data={[{model: "XGBoost", MAE: 0.29, RMSE: 0.49}]}
  xKey="model"
  bars={[{key: "MAE", color: "#f59e0b"}, {key: "RMSE", color: "#ef4444"}]}
  title="Error Metrics"
  height={280}
/>
```

**`RadarChartComponent`** — For multi-dimensional waste model comparison:
```tsx
<RadarChartComponent
  data={[
    {metric: "Accuracy", legacy: 0.638, modern: 0.629},
    {metric: "F1 Score", legacy: 0.584, modern: 0.548},
    ...
  ]}
  title="Waste Model Comparison"
/>
```

**`LineChartComponent`** — For time-series trends (available, used for future time-series views):
```tsx
<LineChartComponent
  data={[{month: "Jan", demand: 2.3}]}
  xKey="month"
  lines={[{key: "demand", color: "#22c55e"}]}
/>
```

All chart wrappers are `"use client"` components (Recharts requires browser DOM).

---

## 5. API Service Layer

**File:** `frontend/services/api.ts`

A typed HTTP client wrapping native `fetch`:

```typescript
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
```

**Error handling:** Non-2xx responses throw an `Error` with the server's `detail` message.

**All API functions:**

```typescript
export const api = {
  getPurchases: (limit = 50) =>
    request<Purchase[]>(`/purchases?limit=${limit}`),

  addPurchase: (data: PurchaseCreate) =>
    request<Purchase>("/add-purchase", { method: "POST", body: JSON.stringify(data) }),

  getItems: () =>
    request<Item[]>("/items"),

  predictDemand: () =>
    request<DemandResponse>("/predict-demand"),

  predictWaste: () =>
    request<WasteResponse>("/predict-waste"),

  optimizeBudget: (budget, household_size, preferred_categories?) =>
    request<OptimizationResult>("/optimize-budget", {
      method: "POST",
      body: JSON.stringify({ budget, household_size, preferred_categories }),
    }),

  generatePlan: (household_size = 3) =>
    request<WeekPlanResponse>(`/generate-plan?household_size=${household_size}`),

  compareModels: () =>
    request<ComparisonResult>("/compare-models"),
};
```

**Changing the backend URL:**  
Set `NEXT_PUBLIC_API_URL` in a `.env.local` file:
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

---

## 6. Constants and Configuration

**File:** `frontend/lib/constants.ts`

```typescript
export const CATEGORIES = ["Vegetables", "Fruits", "Dairy", "Grains", "Protein", "Beverages"];

export const ITEMS_BY_CATEGORY: Record<string, string[]> = {
  Vegetables: ["Tomato", "Potato", "Onion", "Carrot", "Spinach", "Broccoli", "Cucumber", "Bell Pepper"],
  Fruits: ["Apple", "Banana", "Orange", "Mango", "Grapes"],
  // ...
};

export const CATEGORY_COLORS: Record<string, string> = {
  Vegetables: "#22c55e",  // green
  Fruits:     "#f97316",  // orange
  Dairy:      "#3b82f6",  // blue
  Grains:     "#eab308",  // yellow
  Protein:    "#ef4444",  // red
  Beverages:  "#8b5cf6",  // purple
};

export const RISK_COLORS = {
  High:   "badge-high",    // red badge
  Medium: "badge-medium",  // yellow badge
  Low:    "badge-low",     // green badge
};
```

These constants are shared across all pages and components for consistency.

---

## 7. Styling System

**Framework:** Tailwind CSS 3 with custom component layer

### Custom Components (`globals.css`)

```css
@layer components {
  .card {
    @apply bg-white rounded-xl shadow-sm border border-gray-100 p-6;
  }
  .btn-primary {
    @apply bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-lg;
  }
  .btn-secondary {
    @apply bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-lg;
  }
  .badge-high   { @apply bg-red-100    text-red-700    text-xs font-medium px-2 py-1 rounded-full; }
  .badge-medium { @apply bg-yellow-100 text-yellow-700 text-xs font-medium px-2 py-1 rounded-full; }
  .badge-low    { @apply bg-green-100  text-green-700  text-xs font-medium px-2 py-1 rounded-full; }
}
```

### Color Palette

| Color | Usage | Tailwind class |
|-------|-------|----------------|
| Green (primary) | CTAs, active states, positive metrics | `green-600` |
| Amber | Legacy model, warning states | `amber-500` |
| Red | High risk, error states | `red-500` |
| Blue | Dairy category, info states | `blue-500` |
| Purple | Modern model indicators, optimization score | `purple-600` |
| Gray | Background, borders, secondary text | `gray-50`–`gray-700` |

### Responsive Breakpoints

| Breakpoint | Width | Layout changes |
|-----------|-------|----------------|
| Default | < 640px | Single column, icons only in nav |
| `sm:` | ≥ 640px | 2-column grids, labels in nav |
| `md:` | ≥ 768px | Nav text visible |
| `lg:` | ≥ 1024px | 3–4 column grids |

---

## 8. Data Flow and State Management

The frontend uses **local component state** (no global state manager like Redux/Zustand). Each page manages its own data independently.

### Standard Page Pattern

```typescript
"use client";

export default function SomePage() {
  const [data, setData] = useState<DataType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.someEndpoint();
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (error)   return <ErrorBanner message={error} />;
  return <PageContent data={data} />;
}
```

### Why No Global State Manager?

- Only 5 pages, each with independent data needs
- No shared mutable state between pages (dashboard and recommendations show same data but fetch independently)
- Local state is simpler to debug and maintain for a project of this scale

---

## 9. Chart Components (Deep Dive)

All chart components are built as wrapper components in `components/Chart.tsx`:

### BarChartComponent

Used on: Dashboard (category spend), Recommendations (demand comparison, waste comparison), Comparison (model error bars)

```tsx
<ResponsiveContainer width="100%" height={height}>
  <BarChart data={data}>
    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
    <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
    <YAxis tick={{ fontSize: 12 }} />
    <Tooltip contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
    <Legend wrapperStyle={{ fontSize: 12 }} />
    {bars.map(b => <Bar key={b.key} dataKey={b.key} fill={b.color} radius={[4,4,0,0]} />)}
  </BarChart>
</ResponsiveContainer>
```

`radius={[4,4,0,0]}` gives bars rounded top corners for a modern appearance.

### RadarChartComponent

Used on: Comparison page (waste model 5-metric comparison)

```tsx
<RadarChart data={data}>
  <PolarGrid />
  <PolarAngleAxis dataKey="metric" />
  <PolarRadiusAxis domain={[0, 1]} />
  <Radar name="Legacy" dataKey="legacy" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
  <Radar name="Modern" dataKey="modern" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
</RadarChart>
```

`domain={[0, 1]}` normalises all 5 metrics (accuracy, precision, recall, F1, AUC) onto the same 0–1 scale for fair visual comparison.

---

## 10. TypeScript Types

All API response types are defined in `services/api.ts`:

```typescript
// Core data types
export interface Purchase { id, user_id, item, category, quantity, price, purchase_date }
export interface DemandPrediction { item, category, predicted_quantity_xgboost,
  predicted_quantity_linear, historical_avg, confidence, recommended_quantity,
  unit_price, days_until_next, seasonal_factor }
export interface WasteAlert { item, category, waste_probability_rf,
  waste_probability_logistic, risk_level, days_until_expiry, recommendation, shelf_life }
export interface OptimizedItem { item, category, quantity, unit_price, total_cost,
  priority_score, nutrition_score }
export interface OptimizationResult { total_cost, budget, savings, optimization_score,
  items_count, items: OptimizedItem[] }

// Comparison types
export interface ModelMetrics {
  split; mae?; rmse?; r2?; directional_accuracy?;  // regression
  accuracy?; precision?; recall?; f1?; roc_auc?;  // classification
}
export interface ComparisonResult {
  demand_prediction: { legacy, modern, winner, improvement, ... }
  waste_prediction: { legacy, modern, winner, improvement, ... }
  feature_importance: { demand_xgboost, waste_rf }
}
```

---

## 11. Build and Development

### Development Commands

```bash
npm run dev      # Start dev server with hot reload (port 3000)
npm run build    # Production build (type-checks + optimizes)
npm run start    # Serve production build
npm run lint     # ESLint check
```

### Environment Variables

```bash
# .env.local (optional)
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### Build Output

```
Route (app)          Size      First Load JS
/ (landing)          175 B     91.4 kB
/add                 4.46 kB   88.9 kB
/comparison          4.37 kB   193 kB
/dashboard           3.86 kB   193 kB
/recommendations     4.71 kB   194 kB
```

All pages compile cleanly. Recharts adds ~100 kB to chart-heavy pages.

### TypeScript Strict Mode

The project runs with `"strict": true` in `tsconfig.json`. All component props, API responses, and state types are explicitly typed.
