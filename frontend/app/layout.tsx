import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/contexts/ToastContext";
import AuthGuard from "@/components/AuthGuard";
import OnboardingModal from "@/components/OnboardingModal";
import ErrorBoundary from "@/components/ErrorBoundary";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "SmartGrocery — India",
    template: "%s | SmartGrocery",
  },
  description: "AI-powered grocery management for Indian households — save money, reduce waste, shop smarter.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <ToastProvider>
            <Navbar />
            <AuthGuard>
              <OnboardingModal />
              <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <ErrorBoundary>
                  {children}
                </ErrorBoundary>
              </main>
            </AuthGuard>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
