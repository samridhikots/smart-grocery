"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShoppingCart, TrendingUp, Trash2, IndianRupee,
  AlertCircle, Leaf, ArrowRight, CheckCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Add your purchases",
    desc:  "Log what you buy — items, quantities, prices. Takes 10 seconds per item.",
    bg:    "bg-blue-100 text-blue-700",
  },
  {
    step: "2",
    title: "AI analyses your patterns",
    desc:  "7 ML models study your habits, flag waste risks, detect overspending, and plan your next shop.",
    bg:    "bg-green-100 text-green-700",
  },
  {
    step: "3",
    title: "Save money every month",
    desc:  "Get a personalised shopping list, waste alerts, and budget tips tailored to your household.",
    bg:    "bg-purple-100 text-purple-700",
  },
];

const BENEFITS = [
  { icon: IndianRupee, title: "Save ₹500–₹1,500/month",  desc: "Budget optimizer builds the best shopping list within your ₹ limit.", bg: "text-green-600  bg-green-50"  },
  { icon: Trash2,      title: "Cut food waste by 30%",    desc: "Spoilage alerts tell you which items to use before they go bad.",     bg: "text-red-600   bg-red-50"    },
  { icon: AlertCircle, title: "Never overspend again",    desc: "Isolation Forest AI flags the months your grocery bill spikes.",     bg: "text-orange-600 bg-orange-50" },
  { icon: Leaf,        title: "Reduce your CO₂",          desc: "Track your environmental footprint and get eco-friendly swaps.",     bg: "text-emerald-600 bg-emerald-50" },
];

const INDIA_FACTS = [
  "Festival demand spikes — Diwali, Holi, Eid & more",
  "Monsoon perishable alerts (Jun–Sep)",
  "Prices in ₹ with real mandi index data",
  "Real brands: Amul, Aashirvaad, India Gate, Tata",
];

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) router.replace("/dashboard");
  }, [user, isLoading, router]);

  // Show nothing while redirect is in flight for logged-in users
  if (!isLoading && user) return null;

  return (
    <div className="space-y-20">

      {/* Hero */}
      <section className="text-center py-14 animate-fade-in">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-6"
          style={{ background: "var(--green-light)", color: "var(--green-primary)", border: "1.5px solid #b8e0c0" }}
        >
          <ShoppingCart className="w-4 h-4" /> Built for Indian households
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold text-white mb-5 leading-tight tracking-tight">
          Save money.
          <span className="block" style={{ color: "var(--green-primary)" }}>
            Reduce waste. Shop smarter.
          </span>
        </h1>
        <p className="text-lg text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed">
          SmartGrocery uses 7 AI models to predict what you need, warn you about spoilage,
          and keep your ₹ grocery budget on track.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/auth/signup" className="btn-primary text-base px-7 py-3 gap-2">
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/auth/signin" className="btn-secondary text-base px-7 py-3">
            Sign in
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section>
        <h2 className="text-2xl font-bold text-white text-center mb-10">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {HOW_IT_WORKS.map(({ step, title, desc, bg }, i) => (
            <div
              key={step}
              className={`card card-interactive text-center animate-slide-up stagger-${i + 1}`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 text-xl font-bold ${bg}`}>
                {step}
              </div>
              <h3 className="font-bold text-gray-800 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section>
        <h2 className="text-2xl font-bold text-gray-800 text-center mb-10">What you get</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {BENEFITS.map(({ icon: Icon, title, desc, bg }, i) => (
            <div
              key={title}
              className={`card card-interactive flex items-start gap-4 animate-slide-up stagger-${i + 1}`}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 mb-1">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* India context */}
      <section
        className="card animate-slide-up"
        style={{ background: "linear-gradient(135deg, #fff8f0 0%, #fffbf2 100%)", borderColor: "#f0d9a8" }}
      >
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

      {/* ML models */}
      <section
        className="card animate-slide-up"
        style={{ background: "var(--bg-page)", borderColor: "#dbd6ce" }}
      >
        <h2 className="text-lg font-bold text-gray-700 mb-5 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" style={{ color: "var(--green-primary)" }} /> 7 ML models under the hood
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          {[
            { tag: "Regression",     label: "Demand Prediction",      models: "XGBoost vs Ridge Regression" },
            { tag: "Classification", label: "Waste Risk",              models: "TabNet vs Logistic Regression" },
            { tag: "Anomaly",        label: "Overspending Detection",  models: "Isolation Forest" },
            { tag: "Rules",          label: "Product Recommendations", models: "FP-Growth" },
            { tag: "Optimization",   label: "Budget Optimizer",        models: "Fractional Knapsack" },
            { tag: "Eco Tracker",    label: "Sustainability",          models: "Rule-based scoring" },
          ].map(({ tag, label, models }, i) => (
            <div
              key={label}
              className={`bg-white rounded-xl p-3.5 animate-slide-up stagger-${Math.min(i + 1, 8)}`}
              style={{ border: "1.5px solid #e5e0d8" }}
            >
              <span
                className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: "var(--green-light)", color: "var(--green-primary)" }}
              >
                {tag}
              </span>
              <p className="font-semibold text-gray-800 mt-2">{label}</p>
              <p className="text-gray-400 text-xs mt-0.5">{models}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4">
          Trained on 6 Kaggle datasets — BigBasket, Blinkit, Mandi Price Index, Food Waste, and more.{" "}
          <Link href="/comparison" className="underline" style={{ color: "var(--green-primary)" }}>
            See the full Model Comparison →
          </Link>
        </p>
      </section>

      {/* CTA */}
      <section className="text-center py-10 animate-slide-up">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Ready to shop smarter?</h2>
        <p className="text-gray-400 mb-7">Free to use. No credit card required.</p>
        <Link href="/auth/signup" className="btn-primary text-base px-9 py-3.5">
          Create your account <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

    </div>
  );
}
