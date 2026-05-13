import type { Metadata } from "next";

export const metadata: Metadata = { title: "Add Purchase" };

export default function AddLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
