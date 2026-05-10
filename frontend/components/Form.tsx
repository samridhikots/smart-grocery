"use client";
import { useState, useRef, useEffect } from "react";
import { api } from "@/services/api";
import { ITEMS_BY_CATEGORY, CATEGORY_COLORS } from "@/lib/constants";
import { Search } from "lucide-react";

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

// Flat list of all items with their category
const ALL_ITEMS = Object.entries(ITEMS_BY_CATEGORY).flatMap(([category, items]) =>
  items.map((item) => ({ item, category }))
);

export default function PurchaseForm({
  onSuccess,
  prefillItem = "",
  prefillQuantity = "",
}: {
  onSuccess?: () => void;
  prefillItem?: string;
  prefillQuantity?: string;
}) {
  const [form, setForm] = useState<FormState>({ ...INIT, quantity: prefillQuantity });
  const [query, setQuery] = useState(prefillItem);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-select item when prefilled from Shopping List
  useEffect(() => {
    if (prefillItem) {
      const found = ALL_ITEMS.find((i) => i.item.toLowerCase() === prefillItem.toLowerCase());
      if (found) {
        setForm((prev) => ({ ...prev, item: found.item, category: found.category, quantity: prefillQuantity }));
        setQuery(found.item);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillItem]);

  const filtered = query.length > 0
    ? ALL_ITEMS.filter(({ item }) => item.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function selectItem(entry: { item: string; category: string }) {
    setForm((prev) => ({ ...prev, item: entry.item, category: entry.category }));
    setQuery(entry.item);
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    // Clear item selection if user edits text after selecting
    if (val !== form.item) {
      setForm((prev) => ({ ...prev, item: "", category: "" }));
    }
    setOpen(true);
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.item || !form.category || !form.quantity || !form.price) {
      setMessage({ type: "error", text: "Please select an item and fill in all required fields." });
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
      setQuery("");
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
        {/* Autocomplete item search */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Search Item *</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-gray-400" />
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleQueryChange}
              onFocus={() => query.length > 0 && setOpen(true)}
              placeholder="Type to search — e.g. Tomato, Milk, Atta…"
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              autoComplete="off"
            />
            {form.category && (
              <span
                className="absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-white px-2 my-1.5 rounded"
                style={{ background: CATEGORY_COLORS[form.category] || "#6b7280" }}
              >
                {form.category}
              </span>
            )}

            {open && filtered.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
              >
                {filtered.map(({ item, category }) => (
                  <button
                    key={`${category}-${item}`}
                    type="button"
                    onMouseDown={() => selectItem({ item, category })}
                    className="flex items-center justify-between w-full px-4 py-2.5 text-sm text-left hover:bg-green-50 transition-colors"
                  >
                    <span className="font-medium text-gray-800">{item}</span>
                    <span
                      className="text-xs text-white px-2 py-0.5 rounded-full"
                      style={{ background: CATEGORY_COLORS[category] || "#6b7280" }}
                    >
                      {category}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {open && query.length > 0 && filtered.length === 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm text-gray-500">
                No items found for &ldquo;{query}&rdquo;
              </div>
            )}
          </div>
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
