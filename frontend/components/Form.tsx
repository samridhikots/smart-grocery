"use client";
import { useState } from "react";
import { api } from "@/services/api";
import { ITEMS_BY_CATEGORY } from "@/lib/constants";

interface FormState {
  item: string;
  category: string;
  quantity: string;
  price: string;
  purchase_date: string;
}

const INIT: FormState = {
  item: "",
  category: "",
  quantity: "",
  price: "",
  purchase_date: new Date().toISOString().split("T")[0],
};

const CATEGORIES = Object.keys(ITEMS_BY_CATEGORY);

export default function PurchaseForm({ onSuccess }: { onSuccess?: () => void }) {
  const [form, setForm] = useState<FormState>(INIT);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const items = form.category ? ITEMS_BY_CATEGORY[form.category] ?? [] : [];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "category") {
      setForm((prev) => ({ ...prev, category: value, item: "" }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.item || !form.category || !form.quantity || !form.price) {
      setMessage({ type: "error", text: "Please fill in all required fields." });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      await api.addPurchase({
        item: form.item,
        category: form.category,
        quantity: parseFloat(form.quantity),
        price: parseFloat(form.price),
        purchase_date: form.purchase_date,
      });
      setMessage({ type: "success", text: `Added ${form.quantity} × ${form.item} to your purchases!` });
      setForm(INIT);
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add purchase";
      setMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm font-medium ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Select category…</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Item *</label>
          <select
            name="item"
            value={form.item}
            onChange={handleChange}
            disabled={!form.category}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">{form.category ? "Select item…" : "Select category first"}</option>
            {items.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (kg / units) *</label>
          <input
            type="number" name="quantity" value={form.quantity} onChange={handleChange}
            min="0.1" step="0.1" placeholder="e.g. 1.5"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹ total) *</label>
          <input
            type="number" name="price" value={form.price} onChange={handleChange}
            min="1" step="1" placeholder="e.g. 55"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
          <input
            type="date" name="purchase_date" value={form.purchase_date} onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed">
        {loading ? "Adding…" : "Add Purchase"}
      </button>
    </form>
  );
}
