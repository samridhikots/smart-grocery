"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp, Cpu, Database, Zap, Info } from "lucide-react";
import ModelInfoModal from "./ModelInfoModal";

export interface ModelCardData {
  name:         string;
  algorithm:    string;
  role:         string;
  metrics:      Record<string, string>;
  features:     number | null;
  dataset:      string;
  inference_ms: string;
  modelKey:     string;
}

function ModelCard({ model, onInfo }: { model: ModelCardData; onInfo: (key: string) => void }) {
  return (
    <div
      className="bg-white rounded-xl p-4 flex flex-col gap-3"
      style={{ border: "1.5px solid #e5e0d8" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <Cpu className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
            <span className="text-sm font-bold text-gray-800">{model.name}</span>
          </div>
          <span className="text-xs text-gray-500">{model.algorithm}</span>
        </div>
        <button
          onClick={() => onInfo(model.modelKey)}
          className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          aria-label={`More info about ${model.name}`}
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      <div className="text-xs bg-green-50 text-green-700 font-medium px-2.5 py-1 rounded-full w-fit">
        {model.role}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {Object.entries(model.metrics).map(([k, v]) => (
          <div key={k} className="bg-gray-50 rounded-lg px-2.5 py-1.5">
            <p className="text-xs text-gray-400 mb-0.5">{k}</p>
            <p className="text-sm font-bold text-gray-800">{v}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500 pt-1 border-t border-gray-100">
        <div className="flex items-center gap-1">
          <Database className="w-3 h-3" />
          <span className="truncate">{model.dataset}</span>
        </div>
        {model.features !== null && (
          <span className="flex-shrink-0">{model.features} features</span>
        )}
        <div className="flex items-center gap-1 ml-auto flex-shrink-0">
          <Zap className="w-3 h-3 text-yellow-500" />
          <span>{model.inference_ms}</span>
        </div>
      </div>
    </div>
  );
}

export default function AIEnginePanel({
  models,
  title = "AI Engine",
}: {
  models: ModelCardData[];
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [modalKey, setModalKey] = useState<string | null>(null);

  return (
    <div className="mt-8">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full text-left group"
        aria-expanded={open}
      >
        <Cpu className="w-4 h-4 text-green-600" />
        <span className="text-xs font-bold uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">
          {title}
        </span>
        <div className="flex-1 h-px bg-gray-200 mx-2" />
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-400" />
          : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 animate-fade-in">
          {models.map((m) => (
            <ModelCard key={m.modelKey} model={m} onInfo={setModalKey} />
          ))}
        </div>
      )}

      {modalKey && (
        <ModelInfoModal modelKey={modalKey} onClose={() => setModalKey(null)} />
      )}
    </div>
  );
}
