"use client";
import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Check, AlertCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold animate-slide-up pointer-events-auto whitespace-nowrap ${
              toast.type === "success"
                ? "text-white"
                : toast.type === "error"
                ? "bg-red-600 text-white"
                : "bg-gray-800 text-white"
            }`}
            style={toast.type === "success" ? { background: "var(--green-primary)" } : undefined}
          >
            {toast.type === "success" && <Check className="w-4 h-4 flex-shrink-0" />}
            {toast.type === "error" && <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {toast.type === "info" && <Info className="w-4 h-4 flex-shrink-0" />}
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
