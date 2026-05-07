import Link from "next/link";
import { ShoppingCart, TrendingUp, Trash2, IndianRupee, BarChart2, Lightbulb, Leaf, AlertCircle, ArrowRight } from "lucide-react";

const features = [
  {
    icon: TrendingUp,
    title: "Demand Prediction",
    description: "XGBoost vs Ridge Regression forecast your next purchase quantities using 13 India-specific features.",
    href: "/recommendations",
    color: "text-blue-600 bg-blue-50",
  },
  {
    icon: Trash2,
    title: "Waste Alerts",
    description: "TabNet deep learning classifier flags items at high spoilage risk — with monsoon and summer boosts.",
    href: "/recommendations",
    color: "text-red-600 bg-red-50",
  },
  {
    icon: IndianRupee,
    title: "Budget Optimizer",
    description: "Fractional knapsack algorithm builds the highest-value grocery list within your ₹ budget.",
    href: "/recommendations",
    color: "text-green-600 bg-green-50",
  },
  {
    icon: AlertCircle,
    title: "Overspending Alerts",
    description: "Isolation Forest detects when your monthly grocery spend is anomalous vs your 3-month average.",
    href: "/insights",
    color: "text-orange-600 bg-orange-50",
  },
  {
    icon: Lightbulb,
    title: "Smart Insights",
    description: "Personalized alerts combining all 7 ML models into one prioritized action list for your household.",
    href: "/insights",
    color: "text-yellow-600 bg-yellow-50",
  },
  {
    icon: Leaf,
    title: "Sustainability Tracker",
    description: "Track your CO₂ footprint, plastic packaging usage, and get eco-friendly swap suggestions.",
    href: "/sustainability",
    color: "text-emerald-600 bg-emerald-50",
  },
  {
    icon: BarChart2,
    title: "Model Comparison",
    description: "Side-by-side metrics — R², F1, AUC, feature importance — for all 7 ML models.",
    href: "/comparison",
    color: "text-purple-600 bg-purple-50",
  },
];

const datasets = [
  { name: "BigBasket Product Catalog", records: "Kaggle dataset", purpose: "Indian product names, brands & categories" },
  { name: "Blinkit Grocery Data", records: "Kaggle dataset", purpose: "Real-time price & availability signals" },
  { name: "Food Waste Tracker", records: "Kaggle dataset", purpose: "Waste classification training data" },
  { name: "Indian Grocery Store", records: "Kaggle dataset", purpose: "Purchase frequency & transaction patterns" },
  { name: "Mandi Price Index", records: "Kaggle dataset", purpose: "Wholesale price variation feature" },
  { name: "Household Consumption", records: "Kaggle dataset", purpose: "Per-household usage-rate features" },
  { name: "India-specific Synthetic", records: "Fallback data", purpose: "Used when Kaggle CSVs are not present" },
];

export default function Home() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="text-center py-12">
        <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
          <ShoppingCart className="w-4 h-4" /> Smart Grocery for Indian Households
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
          AI-Powered Grocery Management
          <span className="block text-green-600">Built for India</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-8">
          Track expenditures, predict demand, reduce food waste, detect overspending, and monitor your
          environmental footprint — all tailored for Indian households with real ₹ prices and brands.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className="btn-primary flex items-center gap-2">
            View Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/insights" className="btn-secondary">View My Insights</Link>
          <Link href="/comparison" className="btn-secondary">Compare Models</Link>
        </div>
      </section>

      {/* Feature cards */}
      <section>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">System Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map(({ icon: Icon, title, description, href, color }) => (
            <Link key={title} href={href} className="card hover:shadow-md transition-shadow group">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-1 group-hover:text-green-700">{title}</h3>
              <p className="text-sm text-gray-500">{description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Datasets */}
      <section>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Data Sources</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {datasets.map(({ name, records, purpose }, i) => (
            <div key={name} className="card flex items-start gap-3">
              <span className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-gray-800">{name}</p>
                <p className="text-xs text-green-600 font-medium">{records}</p>
                <p className="text-sm text-gray-500 mt-0.5">{purpose}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ML Models */}
      <section className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">7 ML Models — Architecture</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Demand Prediction (Regression)</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">Legacy</span>
                Ridge Linear Regression — 13 features
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">Modern</span>
                XGBoost Regressor (200 trees) — 13 features
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Waste Prediction (Classification)</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">Legacy</span>
                Logistic Regression — 24 features
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">Modern</span>
                TabNet Classifier (attention-based) — 24 features
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Additional Intelligence</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">Anomaly</span>
                Isolation Forest — overspending detection
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">Rules</span>
                FP-Growth — co-purchase recommendations
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">Tracker</span>
                Sustainability — CO₂ & eco scoring
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* India context note */}
      <section className="card border-orange-100 bg-orange-50">
        <h3 className="font-semibold text-orange-800 mb-2">India-Specific Context</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-orange-700">
          <div>
            <p className="font-medium mb-1">Seasonal Awareness</p>
            <p>Monsoon months (Jun–Sep) boost perishable waste risk. Summer months (Apr–Jun) adjust mango and produce demand.</p>
          </div>
          <div>
            <p className="font-medium mb-1">Festival Calendar</p>
            <p>Demand spikes automatically applied for Diwali, Holi, Raksha Bandhan, Dussehra, and Makar Sankranti.</p>
          </div>
          <div>
            <p className="font-medium mb-1">Real Indian Brands</p>
            <p>Products tagged with Amul, Aashirvaad, India Gate, Tata, Fortune, and other familiar brands.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
