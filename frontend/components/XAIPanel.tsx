"use client";
import { XAIFactor } from "@/services/api";

function ContribBar({ factor, max }: { factor: XAIFactor; max: number }) {
  const pct = max > 0 ? Math.round((factor.contribution / max) * 100) : 0;
  const isUp = factor.direction === "up";
  const isDown = factor.direction === "down";

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="w-32 flex-shrink-0 truncate text-gray-600 font-medium" title={factor.label}>
        {factor.label}
      </div>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isUp ? "bg-orange-400" : isDown ? "bg-green-400" : "bg-gray-300"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`w-20 flex-shrink-0 text-right font-medium ${
          isUp ? "text-orange-600" : isDown ? "text-green-600" : "text-gray-500"
        }`}
      >
        {factor.value}
      </span>
    </div>
  );
}

export default function XAIPanel({ factors }: { factors: XAIFactor[] }) {
  if (!factors || factors.length === 0) return null;
  const maxContrib = Math.max(...factors.map((f) => f.contribution), 0.001);

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2 animate-fade-in">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
        Top contributing factors
      </p>
      {factors.map((f) => (
        <ContribBar key={f.feature} factor={f} max={maxContrib} />
      ))}
      <p className="text-xs text-gray-400 mt-2">
        <span className="inline-block w-2 h-2 rounded-full bg-orange-400 mr-1" />increases demand/risk ·
        <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1 ml-2" />reduces it
      </p>
    </div>
  );
}
