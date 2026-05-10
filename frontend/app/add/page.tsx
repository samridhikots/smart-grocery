"use client";
import { useEffect, useState, useCallback } from "react";
import PurchaseForm from "@/components/Form";
import Table from "@/components/Table";
import { api, Purchase } from "@/services/api";
import { PlusCircle, RefreshCw } from "lucide-react";
import { CATEGORY_COLORS } from "@/lib/constants";

export default function AddPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getPurchases(50);
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
        <p className="text-gray-500 text-sm mt-1">Log what you buy to track your spending.</p>
      </div>

      <div className="card">
        <PurchaseForm onSuccess={fetchPurchases} />
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
