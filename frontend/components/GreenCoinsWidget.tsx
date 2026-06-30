"use client";
import { useEffect, useState, useRef } from "react";
import { api, GreenCoinsData } from "@/services/api";
import { Leaf, TrendingUp } from "lucide-react";

function AnimatedCount({ to, duration = 800 }: { to: number; duration?: number }) {
  const [val, setVal] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    if (to === 0) { setVal(0); return; }
    const start = Date.now();
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const e = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(to * e));
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else setVal(to);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to, duration]);
  return <>{val}</>;
}

export default function GreenCoinsWidget() {
  const [data, setData] = useState<GreenCoinsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getGreenCoins()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-5 w-32 bg-gray-200 rounded mb-3" />
        <div className="h-10 w-24 bg-gray-200 rounded" />
      </div>
    );
  }

  if (!data) return null;

  const pct = data.next_level_at > 0 && data.next_level_at !== data.balance
    ? Math.min(100, Math.round((data.balance / data.next_level_at) * 100))
    : 100;

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Leaf className="w-5 h-5 text-green-600" />
        <h3 className="text-base font-bold text-gray-800">Green Coins</h3>
      </div>

      {/* Balance + level */}
      <div className="flex items-end gap-4 mb-4">
        <div>
          <p className="text-4xl font-black text-green-600">
            <AnimatedCount to={data.balance} />
          </p>
          <p className="text-xs text-gray-500 mt-0.5">coins earned</p>
        </div>
        <div className="mb-1 text-right">
          <span className="text-2xl">{data.level_icon}</span>
          <p className="text-xs font-bold text-gray-700">{data.level}</p>
        </div>
      </div>

      {/* Progress to next level */}
      {pct < 100 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progress to next level</span>
            <span>{data.balance} / {data.next_level_at}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-1000"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Earn more tip */}
      <div className="bg-green-50 rounded-xl px-3 py-2.5 mb-4 flex items-start gap-2">
        <TrendingUp className="w-3.5 h-3.5 text-green-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-green-700">
          Earn <strong>25 coins</strong> per Fruits & Vegetables purchase ·
          <strong>15</strong> for Dairy & Grains ·
          <strong>10</strong> for Protein & Beverages
        </p>
      </div>

      {/* Recent history */}
      {data.history.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Recent Activity</p>
          <ul className="space-y-1.5">
            {data.history.slice(0, 5).map((h) => (
              <li key={h.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-600 truncate max-w-[180px]">{h.item}</span>
                <span className="text-green-600 font-semibold flex-shrink-0">+{h.amount} 🌱</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.history.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-2">
          Add your first purchase to earn coins!
        </p>
      )}
    </div>
  );
}
