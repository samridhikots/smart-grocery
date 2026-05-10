"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PurchaseForm from "@/components/Form";
import Table from "@/components/Table";
import { api, Purchase } from "@/services/api";
import { PlusCircle, RefreshCw, Target } from "lucide-react";
import { CATEGORY_COLORS } from "@/lib/constants";

const UNLOCK_MILESTONES = [
  { count: 5,  label: "Waste risk predictions appear" },
  { count: 10, label: "Shopping list gets personalised" },
  { count: 20, label: "Overspend detection kicks in" },
];

function ProgressStrip({ count }: { count: number }) {
  const next = UNLOCK_MILESTONES.find((m) => m.count > count);
  if (!next) return null;
  const pct = Math.round((count / next.count) * 100);
  return (
    <div className="card bg-green-50 border-green-200 flex items-center gap-4 py-3">
      <Target className="w-5 h-5 text-green-600 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-green-800 mb-1.5">
          You&apos;ve added {count} item{count !== 1 ? "s" : ""} · Add {next.count - count} more to unlock:{" "}
          <span className="font-bold">{next.label}</span>
        </p>
        <div className="h-1.5 bg-green-200 rounded-full overflow-hidden">
          <div className="h-full bg-green-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="text-xs text-green-600 font-bold flex-shrink-0">{count} / {next.count}</span>
    </div>
  );
}

function AddPageInner() {
  const searchParams = useSearchParams();
  const prefillItem     = searchParams.get("item") ?? "";
  const prefillQuantity = searchParams.get("quantity") ?? "";

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getPurchases(200);
      setPurchases(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPurchases(); }, [fetchPurchases]);

  const columns = [
    { key: "purchase_date", header: "Date" },
    { key: "item", header: "Item" },
    {
      key: "category",
      header: "Category",
      render: (r: Purchase) => (
        <span
          className="px-2 py-0.5 rounded text-xs font-medium text-white"
          style={{ background: CATEGORY_COLORS[r.category] || "#6b7280" }}
        >
          {r.category}
        </span>
      ),
    },
    { key: "quantity", header: "Quantity", render: (r: Purchase) => r.quantity.toFixed(2) },
    { key: "price", header: "Price (₹)", render: (r: Purchase) => `₹${r.price.toFixed(2)}` },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <PlusCircle className="w-6 h-6 text-green-600" /> Add Purchase
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Every item you log makes your predictions more accurate — takes 10 seconds per item.
        </p>
      </div>

      <ProgressStrip count={purchases.length} />

      <div className="card">
        <PurchaseForm
          onSuccess={fetchPurchases}
          prefillItem={prefillItem}
          prefillQuantity={prefillQuantity}
        />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-800">Recent Purchases</h2>
          <button
            onClick={fetchPurchases}
            disabled={loading}
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <Table
          columns={columns as never}
          data={purchases as never}
          emptyMessage="No purchases yet. Add your first one above!"
        />
      </div>
    </div>
  );
}

export default function AddPage() {
  return (
    <Suspense>
      <AddPageInner />
    </Suspense>
  );
}
