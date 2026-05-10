import Link from "next/link";
import { ShoppingCart, TrendingUp, Trash2, IndianRupee, AlertCircle, Leaf, ArrowRight, CheckCircle } from "lucide-react";

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Add your purchases",
    desc: "Log what you buy — items, quantities, prices. Takes 10 seconds per item.",
    color: "bg-blue-50 text-blue-600",
  },
  {
    step: "2",
    title: "AI analyses your patterns",
    desc: "7 ML models study your habits, flag waste risks, detect overspending, and plan your next shop.",
    color: "bg-green-50 text-green-600",
  },
  {
    step: "3",
    title: "Save money every month",
    desc: "Get a personalised shopping list, waste alerts, and budget tips tailored to your household.",
    color: "bg-purple-50 text-purple-600",
  },
];

const BENEFITS = [
  { icon: IndianRupee, title: "Save ₹500–₹1,500/month", desc: "Budget optimizer builds the best shopping list within your ₹ limit.", color: "text-green-600 bg-green-50" },
  { icon: Trash2,      title: "Cut food waste by 30%",  desc: "Spoilage alerts tell you which items to use before they go bad.",     color: "text-red-600 bg-red-50"   },
  { icon: AlertCircle, title: "Never overspend again",  desc: "Isolation Forest AI flags the months your grocery bill spikes.",     color: "text-orange-600 bg-orange-50" },
  { icon: Leaf,        title: "Reduce your CO₂",        desc: "Track your environmental footprint and get eco-friendly swaps.",     color: "text-emerald-600 bg-emerald-50" },
];

const INDIA_FACTS = [
  "Festival demand spikes — Diwali, Holi, Eid & more",
  "Monsoon perishable alerts (Jun–Sep)",
  "Prices in ₹ with real mandi index data",
  "Real brands: Amul, Aashirvaad, India Gate, Tata",
];

export default function Home() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="text-center py-12">
        <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
          <ShoppingCart className="w-4 h-4" /> Built for Indian households
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4 leading-tight">
          Save money.
          <span className="block text-green-600">Reduce waste. Shop smarter.</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto mb-8">
          SmartGrocery uses 7 AI models to predict what you need, warn you about spoilage,
          and keep your ₹ grocery budget on track.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/auth/signup" className="btn-primary flex items-center gap-2 text-base px-6 py-3">
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/auth/signin" className="btn-secondary text-base px-6 py-3">
            Sign in
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section>
        <h2 className="text-2xl font-bold text-gray-800 text-center mb-8">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {HOW_IT_WORKS.map(({ step, title, desc, color }) => (
            <div key={step} className="card text-center relative">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 text-xl font-bold ${color}`}>
                {step}
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">{title}</h3>
              <p className="text-sm text-gray-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section>
        <h2 className="text-2xl font-bold text-gray-800 text-center mb-8">What you get</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {BENEFITS.map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="card flex items-start gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">{title}</h3>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* India context */}
      <section className="card bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100">
        <div className="flex items-start gap-4">
          <div className="text-3xl">🇮🇳</div>
          <div>
            <h3 className="font-bold text-orange-800 mb-3 text-lg">Designed for India</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {INDIA_FACTS.map((fact) => (
                <div key={fact} className="flex items-center gap-2 text-sm text-orange-700">
                  <CheckCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  {fact}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ML models — for evaluators, kept but simplified */}
      <section className="card bg-gray-50 border-gray-100">
        <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-600" /> 7 ML Models under the hood
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          {[
            { tag: "Regression",     label: "Demand Prediction",       models: "XGBoost vs Ridge Regression" },
            { tag: "Classification", label: "Waste Risk",               models: "TabNet vs Logistic Regression" },
            { tag: "Anomaly",        label: "Overspending Detection",   models: "Isolation Forest" },
            { tag: "Rules",          label: "Product Recommendations",  models: "FP-Growth" },
            { tag: "Optimization",   label: "Budget Optimizer",         models: "Fractional Knapsack" },
            { tag: "Eco Tracker",    label: "Sustainability",           models: "Rule-based scoring" },
          ].map(({ tag, label, models }) => (
            <div key={label} className="bg-white rounded-xl p-3 border border-gray-200">
              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">{tag}</span>
              <p className="font-medium text-gray-800 mt-2">{label}</p>
              <p className="text-gray-500 text-xs mt-0.5">{models}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4">
          Trained on 6 Kaggle datasets — BigBasket, Blinkit, Mandi Price Index, Food Waste, and more.
          See the full comparison on the{" "}
          <Link href="/comparison" className="text-green-600 underline">Model Comparison page</Link>.
        </p>
      </section>

      {/* CTA */}
      <section className="text-center py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Ready to shop smarter?</h2>
        <p className="text-gray-500 mb-6">Free to use. No credit card required.</p>
        <Link href="/auth/signup" className="btn-primary inline-flex items-center gap-2 text-base px-8 py-3">
          Create your account <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </div>
  );
}
