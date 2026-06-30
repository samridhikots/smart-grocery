"use client";
import { Database, Rows3, Columns3, Calendar } from "lucide-react";
import { DatasetStat } from "@/services/api";

export default function DatasetCard({ ds }: { ds: DatasetStat }) {
  const missingColor =
    ds.missing_pct === 0 ? "text-green-600 bg-green-50"
    : ds.missing_pct < 3  ? "text-yellow-600 bg-yellow-50"
    :                        "text-red-600 bg-red-50";

  return (
    <div
      className="bg-white rounded-xl p-4 flex flex-col gap-3"
      style={{ border: "1.5px solid #e5e0d8" }}
    >
      <div className="flex items-start gap-2">
        <Database className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-gray-800 leading-tight">{ds.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{ds.source}</p>
        </div>
      </div>

      <p className="text-xs text-gray-600 leading-relaxed">{ds.purpose}</p>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-50 rounded-lg px-2 py-1.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Rows3 className="w-3 h-3 text-gray-400" />
          </div>
          <p className="text-xs font-bold text-gray-800">{ds.rows.toLocaleString()}</p>
          <p className="text-xs text-gray-400">rows</p>
        </div>
        <div className="bg-gray-50 rounded-lg px-2 py-1.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Columns3 className="w-3 h-3 text-gray-400" />
          </div>
          <p className="text-xs font-bold text-gray-800">{ds.columns}</p>
          <p className="text-xs text-gray-400">cols</p>
        </div>
        <div className={`rounded-lg px-2 py-1.5 text-center ${missingColor}`}>
          <p className="text-xs font-bold">{ds.missing_pct}%</p>
          <p className="text-xs">missing</p>
        </div>
      </div>

      <div className="flex items-center gap-1 text-xs text-gray-400">
        <Calendar className="w-3 h-3" />
        <span>Updated {ds.last_updated}</span>
      </div>
    </div>
  );
}
