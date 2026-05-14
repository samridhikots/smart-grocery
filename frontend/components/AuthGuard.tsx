"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const PUBLIC_PATHS = ["/", "/auth/signin", "/auth/signup"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (!isLoading && !user && !isPublic) {
      router.replace("/auth/signin");
    }
  }, [isLoading, user, isPublic, router]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-gray-200 rounded-lg" />
          <div className="h-9 w-28 bg-gray-200 rounded-xl" />
        </div>
        {/* Stats row skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card h-24" />
          ))}
        </div>
        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card h-64" />
          <div className="card h-64" />
        </div>
        <div className="card h-48" />
      </div>
    );
  }

  // Protected page but not yet logged in — show nothing while redirect fires
  if (!user && !isPublic) return null;

  return <>{children}</>;
}
