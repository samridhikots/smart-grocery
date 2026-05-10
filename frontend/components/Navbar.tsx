"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import {
  ShoppingCart, LayoutDashboard, PlusCircle,
  Lightbulb, Leaf, BarChart2, LogOut, ChevronDown, ShoppingBag,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const PRIMARY_LINKS = [
  { href: "/dashboard",       label: "Dashboard",     icon: LayoutDashboard },
  { href: "/recommendations", label: "Shopping List", icon: ShoppingBag },
  { href: "/insights",        label: "Insights",      icon: Lightbulb },
];

const MORE_LINKS = [
  { href: "/sustainability", label: "Sustainability",   icon: Leaf,     badge: "" },
  { href: "/comparison",     label: "Model Comparison", icon: BarChart2, badge: "Advanced" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    router.replace("/");
  };

  const moreActive = MORE_LINKS.some((l) => l.href === pathname);

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href={user ? "/dashboard" : "/"}
            className="flex items-center gap-2 font-bold text-green-700 text-lg flex-shrink-0"
          >
            <ShoppingCart className="w-6 h-6" />
            <span className="hidden sm:inline">SmartGrocery</span>
          </Link>

          {/* Nav links — only when logged in */}
          {user && (
            <div className="flex items-center gap-1">
              {PRIMARY_LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    pathname === href
                      ? "bg-green-100 text-green-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden md:inline">{label}</span>
                </Link>
              ))}

              {/* Add Purchase — distinct green CTA */}
              <Link
                href="/add"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap mx-1 ${
                  pathname === "/add"
                    ? "bg-green-700 text-white"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
              >
                <PlusCircle className="w-4 h-4 flex-shrink-0" />
                <span className="hidden md:inline">Add Purchase</span>
              </Link>

              {/* More dropdown */}
              <div className="relative" ref={moreRef}>
                <button
                  onClick={() => setMoreOpen((o) => !o)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    moreActive || moreOpen
                      ? "bg-green-100 text-green-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <span className="hidden md:inline">More</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
                </button>

                {moreOpen && (
                  <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
                    {MORE_LINKS.map(({ href, label, icon: Icon, badge }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMoreOpen(false)}
                        className={`flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 transition-colors ${
                          pathname === href ? "text-green-700 bg-green-50" : "text-gray-700"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          {label}
                        </div>
                        {badge && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                            {badge}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Right side */}
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
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/auth/signin" className="btn-secondary text-sm py-1.5 px-3">
                  Sign in
                </Link>
                <Link href="/auth/signup" className="btn-primary text-sm py-1.5 px-3">
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
