export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`skeleton h-3 rounded-full bg-gray-200 ${className}`} />;
}

export function SkeletonCard({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`card animate-pulse space-y-3 ${className}`}>
      <SkeletonLine className="w-1/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonLine key={i} className={i % 2 === 0 ? "w-full" : "w-4/5"} />
      ))}
    </div>
  );
}

export function SkeletonRow({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 animate-pulse ${className}`}>
      <div className="w-8 h-8 rounded-lg bg-gray-200 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonLine className="w-1/2" />
        <SkeletonLine className="w-1/3" />
      </div>
      <SkeletonLine className="w-16" />
    </div>
  );
}

export function SkeletonChart({ className = "" }: { className?: string }) {
  return (
    <div className={`card animate-pulse ${className}`}>
      <SkeletonLine className="w-1/4 mb-4" />
      <div className="flex items-end gap-2 h-32">
        {[60, 80, 45, 90, 70, 55, 75].map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-gray-200 rounded-t-sm"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}
