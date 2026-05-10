"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShoppingCart, LayoutDashboard, PlusCircle, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/add",       label: "Add Purchase", icon: PlusCircle },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.replace("/");
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link
            href={user ? "/dashboard" : "/"}
            className="flex items-center gap-2 font-bold text-green-700 text-lg flex-shrink-0"
          >
            <ShoppingCart className="w-6 h-6" />
            <span className="hidden sm:inline">SmartGrocery</span>
          </Link>

          {user && (
            <div className="flex items-center gap-1">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pathname === href
                      ? "bg-green-100 text-green-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{label}</span>
                </Link>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 flex-shrink-0">
            {user ? (
              <>
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-700 font-medium max-w-[100px] truncate">
                    {user.name.split(" ")[0]}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/auth/signin" className="btn-secondary text-sm py-1.5 px-3">Sign in</Link>
                <Link href="/auth/signup" className="btn-primary text-sm py-1.5 px-3">Sign up</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
