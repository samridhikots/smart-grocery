import type { Metadata } from "next";

export const metadata: Metadata = { title: "Store Comparison" };

export default function ComparisonLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
