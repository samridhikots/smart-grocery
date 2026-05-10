"use client";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Users, IndianRupee, Leaf, ChevronRight, Loader2 } from "lucide-react";

const DIETARY_OPTIONS = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "non-vegetarian", label: "Non-Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "jain", label: "Jain" },
  { value: "gluten-free", label: "Gluten-Free" },
];

export default function OnboardingModal() {
  const { user, completeOnboarding } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [householdSize, setHouseholdSize] = useState(3);
  const [budget, setBudget] = useState(3000);
  const [dietary, setDietary] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!user || user.onboarding_complete) return null;

  const toggleDietary = (val: string) =>
    setDietary((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]));

  const handleFinish = async () => {
    setLoading(true);
    setError("");
    try {
      await completeOnboarding({
        household_size: householdSize,
        monthly_budget: budget,
        dietary_prefs: dietary.join(","),
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-500 px-6 py-5 text-white">
          <h2 className="text-xl font-bold">Welcome, {user.name.split(" ")[0]}!</h2>
          <p className="text-green-100 text-sm mt-0.5">
            Set up your household in 3 quick steps
          </p>
          <div className="flex gap-1.5 mt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  s <= step ? "bg-white" : "bg-green-400/40"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="px-6 py-6">
          {/* Step 1 — Household size */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">Household size</p>
                  <p className="text-sm text-gray-500">How many people shop with this account?</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setHouseholdSize(Math.max(1, householdSize - 1))}
                  className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-lg font-bold text-gray-700 flex items-center justify-center"
                >
                  −
                </button>
                <span className="text-4xl font-bold text-gray-800 w-12 text-center">
                  {householdSize}
                </span>
                <button
                  onClick={() => setHouseholdSize(Math.min(15, householdSize + 1))}
                  className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-lg font-bold text-gray-700 flex items-center justify-center"
                >
                  +
                </button>
              </div>
              <p className="text-center text-sm text-gray-500">
                {householdSize === 1 ? "Just you" : `${householdSize} people`}
              </p>
            </div>
          )}

          {/* Step 2 — Monthly budget */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                  <IndianRupee className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">Monthly grocery budget</p>
                  <p className="text-sm text-gray-500">We'll alert you when you're close to the limit</p>
                </div>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₹</span>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(Math.max(500, parseInt(e.target.value) || 500))}
                  step={500}
                  min={500}
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl text-lg font-semibold text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                {[1500, 3000, 5000, 8000].map((v) => (
                  <button
                    key={v}
                    onClick={() => setBudget(v)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      budget === v
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-green-400"
                    }`}
                  >
                    ₹{v.toLocaleString("en-IN")}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 — Dietary preferences */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <Leaf className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">Dietary preferences</p>
                  <p className="text-sm text-gray-500">Helps personalise your recommendations</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {DIETARY_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => toggleDietary(value)}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                      dietary.includes(value)
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-green-400"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400">Skip if you have no preference</p>
            </div>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="mt-6 flex gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
                className="flex-1 btn-secondary"
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
                className="flex-1 btn-primary flex items-center justify-center gap-1.5"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={loading}
                className="flex-1 btn-primary flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Setting up…</>
                ) : (
                  "Start Shopping Smarter"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
