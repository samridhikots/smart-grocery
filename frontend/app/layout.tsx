import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/contexts/AuthContext";
import AuthGuard from "@/components/AuthGuard";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SmartGrocery — India",
  description: "AI-powered grocery management for Indian households — save money, reduce waste, shop smarter.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <Navbar />
          <AuthGuard>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
