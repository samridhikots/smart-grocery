import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sustainability" };

export default function SustainabilityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
