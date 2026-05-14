export function formatRupees(n: number, decimals = 0): string {
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatPct(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}

export function formatQty(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}
