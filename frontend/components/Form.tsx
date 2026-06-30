"use client";
import { useState, useRef, useEffect, useId, useCallback } from "react";
import { api, BigBasketProduct } from "@/services/api";
import { CATEGORY_COLORS } from "@/lib/constants";
import { useToast } from "@/contexts/ToastContext";
import { Search, Loader2 } from "lucide-react";

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

export default function PurchaseForm({
  onSuccess,
  prefillItem = "",
  prefillQuantity = "",
}: {
  onSuccess?: () => void;
  prefillItem?: string;
  prefillQuantity?: string;
}) {
  const [form, setForm]         = useState<FormState>({ ...INIT, quantity: prefillQuantity });
  const [query, setQuery]       = useState(prefillItem);
  const [open, setOpen]         = useState(false);
  const [results, setResults]   = useState<BigBasketProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [loading, setLoading]   = useState(false);
  const [formError, setFormError] = useState("");
  const { showToast }           = useToast();
  const inputRef                = useRef<HTMLInputElement>(null);
  const dropdownRef             = useRef<HTMLDivElement>(null);
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFocusRef            = useRef(false);
  const listboxId               = useId();

  // Search with 300 ms debounce
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    setSearching(true);
    try {
      const data = await api.searchProducts(q, 8);
      setResults(data);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Prefill from parent (e.g. Shopping List "Log as bought")
  useEffect(() => {
    if (prefillItem) {
      setQuery(prefillItem);
      setForm((prev) => ({ ...prev, item: prefillItem, quantity: prefillQuantity }));
      // Try to search so category auto-fills
      doSearch(prefillItem);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillItem]);

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    setActiveIndex(-1);
    if (val !== form.item) {
      setForm((prev) => ({ ...prev, item: "", category: "" }));
      setUnitPrice(0);
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  }

  function selectProduct(p: BigBasketProduct) {
    const qty = parseFloat(form.quantity) || 0;
    const newUnitPrice = p.sale_price > 0 ? p.sale_price : 0;
    setUnitPrice(newUnitPrice);
    setForm((prev) => ({
      ...prev,
      item:     p.product,
      category: p.category,
      price:    newUnitPrice > 0 && qty > 0
        ? String(Math.round(newUnitPrice * qty))
        : newUnitPrice > 0 ? String(Math.round(newUnitPrice)) : prev.price,
    }));
    setQuery(p.product);
    setOpen(false);
    setActiveIndex(-1);
    skipFocusRef.current = true;
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectProduct(results[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => {
      if (name === "quantity" && unitPrice > 0) {
        const qty = parseFloat(value) || 0;
        return { ...prev, quantity: value, price: qty > 0 ? String(Math.round(unitPrice * qty)) : prev.price };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.item || !form.category || !form.quantity || !form.price) {
      setFormError("Please select an item and fill in all required fields.");
      return;
    }
    setLoading(true);
    setFormError("");
    try {
      await api.addPurchase({
        item:          form.item,
        category:      form.category,
        quantity:      parseFloat(form.quantity),
        price:         parseFloat(form.price),
        purchase_date: form.purchase_date,
      });
      showToast(`Added ${form.item} to your purchases!`);
      setForm(INIT);
      setQuery("");
      setResults([]);
      onSuccess?.();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to add purchase");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {formError && (
        <div className="px-4 py-3 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200">
          {formError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* BigBasket-powered autocomplete */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Search Item *</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              {searching
                ? <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                : <Search className="w-4 h-4 text-gray-400" />}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleQueryChange}
              onFocus={() => { if (skipFocusRef.current) { skipFocusRef.current = false; return; } if (results.length > 0) setOpen(true); }}
              onKeyDown={handleKeyDown}
              placeholder="Search 38,000+ products — e.g. Amul Butter, Basmati Rice…"
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              autoComplete="off"
              role="combobox"
              aria-expanded={open && results.length > 0}
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-activedescendant={activeIndex >= 0 ? `autocomplete-option-${activeIndex}` : undefined}
            />
            {form.category && (
              <span
                className="absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-white px-2 my-1.5 rounded"
                style={{ background: CATEGORY_COLORS[form.category] || "#6b7280" }}
              >
                {form.category}
              </span>
            )}

            {open && results.length > 0 && (
              <div
                ref={dropdownRef}
                id={listboxId}
                role="listbox"
                aria-label="Product suggestions"
                className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
              >
                {results.map((p, idx) => (
                  <button
                    key={`${p.category}-${p.product}-${idx}`}
                    id={`autocomplete-option-${idx}`}
                    type="button"
                    role="option"
                    aria-selected={idx === activeIndex}
                    onClick={() => selectProduct(p)}
                    className={`flex items-center justify-between w-full px-4 py-2.5 text-sm text-left transition-colors ${
                      idx === activeIndex ? "bg-green-50" : "hover:bg-green-50"
                    }`}
                  >
                    <div className="flex-1 min-w-0 mr-2">
                      <span className="font-medium text-gray-800 block truncate">{p.product}</span>
                      {p.brand && (
                        <span className="text-xs text-gray-400">{p.brand}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {p.sale_price > 0 && (
                        <span className="text-xs font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                          ₹{p.sale_price}
                        </span>
                      )}
                      <span
                        className="text-xs text-white px-2 py-0.5 rounded-full"
                        style={{ background: CATEGORY_COLORS[p.category] || "#6b7280" }}
                      >
                        {p.category}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {open && !searching && query.length >= 2 && results.length === 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm text-gray-500">
                No products found for &ldquo;{query}&rdquo; — try a different spelling or category name
              </div>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-400">Powered by BigBasket catalog · Price auto-fills on selection</p>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹ total) * {unitPrice > 0 && <span className="text-xs text-gray-400 font-normal">— auto-updates with qty</span>}</label>
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

      <button type="submit" disabled={loading} className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed px-8 py-3">
        {loading ? "Adding…" : "Add Purchase"}
      </button>
    </form>
  );
}
