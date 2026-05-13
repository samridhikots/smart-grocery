"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PurchaseForm from "@/components/Form";
import Table from "@/components/Table";
import { api, Purchase } from "@/services/api";
import { PlusCircle, RefreshCw, CheckCircle, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { CATEGORY_COLORS } from "@/lib/constants";

const UNLOCK_MILESTONES = [
  { count: 5,  label: "Waste risk predictions appear",  emoji: "🛒" },
  { count: 10, label: "Shopping list gets personalised", emoji: "📊" },
  { count: 20, label: "Overspend detection kicks in",   emoji: "💰" },
];

function ProgressStrip({ count }: { count: number }) {
  const [barPct, setBarPct] = useState(0);
  const next = UNLOCK_MILESTONES.find((m) => m.count > count);

  useEffect(() => {
    if (!next) return;
    const t = setTimeout(() => setBarPct(Math.round((count / next.count) * 100)), 150);
    return () => clearTimeout(t);
  }, [count, next]);

  if (!next) {
    return (
      <div
        className="card flex items-center gap-4 py-4 animate-slide-up"
        style={{ background: "var(--green-light)", borderColor: "#a7d9b0" }}
      >
        <CheckCircle className="w-6 h-6 flex-shrink-0" style={{ color: "var(--green-primary)" }} />
        <div>
          <p className="text-sm font-bold" style={{ color: "var(--green-primary)" }}>
            All features unlocked! 🎉
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            You&apos;ve added {count} items — all predictions are fully personalised.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="card flex items-center gap-4 py-3 animate-slide-up"
      style={{ background: "var(--green-light)", borderColor: "#a7d9b0" }}
    >
      <div className="text-2xl flex-shrink-0">{next.emoji}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold mb-1.5" style={{ color: "var(--green-primary)" }}>
          {count} item{count !== 1 ? "s" : ""} logged &middot; Add {next.count - count} more to unlock:{" "}
          <span className="font-extrabold">{next.label}</span>
        </p>
        <div className="h-2 bg-green-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${barPct}%`,
              background: "var(--green-primary)",
              transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </div>
      </div>
      <span
        className="text-xs font-bold flex-shrink-0 tabular-nums"
        style={{ color: "var(--green-primary)" }}
      >
        {count} / {next.count}
      </span>
    </div>
  );
}

function AddPageInner() {
  const searchParams    = useSearchParams();
  const prefillItem     = searchParams.get("item") ?? "";
  const prefillQuantity = searchParams.get("quantity") ?? "";

  const PAGE_SIZE = 10;

  const [purchases,   setPurchases]   = useState<Purchase[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [fetchError,  setFetchError]  = useState("");
  const [page,        setPage]        = useState(1);

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      const data = await api.getPurchases(200);
      setPurchases(data);
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : "Failed to load purchases");
    } finally {
      setLoading(false);
    }
  }, []);

  const totalPages  = Math.max(1, Math.ceil(purchases.length / PAGE_SIZE));
  const paginated   = purchases.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { fetchPurchases(); }, [fetchPurchases]);

  const columns = [
    { key: "purchase_date", header: "Date" },
    { key: "item",          header: "Item" },
    {
      key: "category",
      header: "Category",
      render: (r: Purchase) => (
        <span
          className="px-2 py-0.5 rounded text-xs font-semibold text-white"
          style={{ background: CATEGORY_COLORS[r.category] || "#6b7280" }}
        >
          {r.category}
        </span>
      ),
    },
    { key: "quantity", header: "Qty",       render: (r: Purchase) => r.quantity.toFixed(2) },
    { key: "price",    header: "Price (₹)", render: (r: Purchase) => `₹${r.price.toFixed(2)}` },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <PlusCircle className="w-6 h-6" style={{ color: "var(--green-primary)" }} />
          Add Purchase
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Every item you log makes your predictions more accurate — takes 10 seconds per item.
        </p>
      </div>

      {/* Animated progress strip */}
      <ProgressStrip count={purchases.length} />

      {/* Form */}
      <div className="card animate-slide-up stagger-1">
        <PurchaseForm
          onSuccess={() => { setPage(1); fetchPurchases(); }}
          prefillItem={prefillItem}
          prefillQuantity={prefillQuantity}
        />
      </div>

      {/* Recent purchases */}
      <div className="card animate-slide-up stagger-2">
        {fetchError && (
          <div className="flex items-center justify-between gap-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{fetchError}</span>
            </div>
            <button onClick={fetchPurchases} className="flex items-center gap-1.5 font-semibold hover:underline flex-shrink-0">
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        )}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Recent Purchases</h2>
          <button
            onClick={fetchPurchases}
            disabled={loading}
            className="btn-secondary text-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <Table
          columns={columns as never}
          data={paginated as never}
          emptyMessage="No purchases yet. Add your first one above!"
        />

        {purchases.length > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, purchases.length)} of {purchases.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
                className="btn-secondary px-2 py-1.5 text-xs disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "…" ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-gray-400 text-xs">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={`min-w-[32px] px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        page === p
                          ? "text-white"
                          : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                      style={page === p ? { background: "var(--green-primary)" } : undefined}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
                className="btn-secondary px-2 py-1.5 text-xs disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
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
