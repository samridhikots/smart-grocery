"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useEffect, useCallback } from "react";
import {
  ShoppingCart, LayoutDashboard, PlusCircle,
  Lightbulb, Leaf, BarChart2, LogOut, ChevronDown, ShoppingBag, Check, X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";

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
  const [moreOpen,      setMoreOpen]      = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [coinBalance,   setCoinBalance]   = useState<number | null>(null);
  const moreRef    = useRef<HTMLDivElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // Fetch coin balance on login and on every page navigation
  useEffect(() => {
    if (!user) return;
    api.getGreenCoins().then((d) => setCoinBalance(d.balance)).catch(() => {});
  }, [user, pathname]);

  // Auto-cancel logout confirmation after 3 s
  useEffect(() => {
    if (!confirmLogout) return;
    const t = setTimeout(() => setConfirmLogout(false), 3000);
    return () => clearTimeout(t);
  }, [confirmLogout]);

  const handleLogoutClick = useCallback(() => {
    if (confirmLogout) {
      logout();
      router.replace("/");
    } else {
      setConfirmLogout(true);
    }
  }, [confirmLogout, logout, router]);

  // Arrow key navigation inside More dropdown
  const handleDropdownKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!moreRef.current) return;
    const items = Array.from(
      moreRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]')
    );
    const idx = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Tab") {
      setMoreOpen(false);
    }
  }, []);

  const moreActive = MORE_LINKS.some((l) => l.href === pathname);

  return (
    <nav
      className="bg-white sticky top-0 z-50"
      style={{
        borderBottom: "1.5px solid #E2E8F0",
        boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">

          {/* Logo */}
          <Link
            href={user ? "/dashboard" : "/"}
            className="flex items-center gap-2 font-bold text-base flex-shrink-0 group"
            style={{ color: "var(--green-primary)" }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform duration-150 group-hover:scale-110"
              style={{ background: "var(--green-primary)" }}
            >
              <ShoppingCart className="w-4 h-4 text-white" />
            </div>
            <span className="hidden sm:inline font-bold tracking-tight">SmartGrocery</span>
          </Link>

          {/* Nav links — only when logged in */}
          {user && (
            <div className="flex items-center gap-0.5">
              {PRIMARY_LINKS.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap ${
                      active
                        ? "text-green-700"
                        : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="hidden md:inline">{label}</span>
                    {active && (
                      <span
                        className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                        style={{ background: "var(--green-primary)" }}
                      />
                    )}
                  </Link>
                );
              })}

              {/* Add Purchase — distinct CTA */}
              <Link
                href="/add"
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150 whitespace-nowrap mx-1 ${
                  pathname === "/add"
                    ? "text-[#1C4A00] bg-green-50 ring-2 ring-green-200"
                    : "text-[#1C4A00] font-bold hover:opacity-90"
                }`}
                style={
                  pathname !== "/add"
                    ? {
                        background: "var(--green-primary)",
                        boxShadow: "0 2px 4px rgba(132,189,0,0.30)",
                      }
                    : undefined
                }
              >
                <PlusCircle className="w-4 h-4 flex-shrink-0" />
                <span className="hidden md:inline">Add Purchase</span>
              </Link>

              {/* More dropdown */}
              <div className="relative" ref={moreRef}>
                <button
                  ref={moreButton}
                  onClick={() => setMoreOpen((o) => !o)}
                  aria-haspopup="true"
                  aria-expanded={moreOpen}
                  aria-label="More navigation links"
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                    moreActive || moreOpen
                      ? "bg-green-50 text-green-700"
                      : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                  }`}
                >
                  <span className="hidden md:inline">More</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {moreOpen && (
                  <div
                    role="menu"
                    aria-label="More links"
                    onKeyDown={handleDropdownKeyDown}
                    className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl overflow-hidden animate-slide-down"
                    style={{
                      border: "1.5px solid #E2E8F0",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.05)",
                    }}
                  >
                    {MORE_LINKS.map(({ href, label, icon: Icon, badge }) => (
                      <Link
                        key={href}
                        href={href}
                        role="menuitem"
                        tabIndex={0}
                        onClick={() => setMoreOpen(false)}
                        className={`flex items-center justify-between px-4 py-3 text-sm transition-colors ${
                          pathname === href
                            ? "text-green-700 bg-green-50"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
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
            {/* Green coins badge */}
            {user && coinBalance !== null && (
              <Link
                href="/sustainability"
                className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold text-green-700 hover:bg-green-50 transition-colors"
                style={{ background: "#f0faf0", border: "1.5px solid #c6e8c9" }}
                title={`${coinBalance} Green Coins`}
              >
                🌱 {coinBalance}
              </Link>
            )}
            {user ? (
              <>
                <div
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl"
                  style={{ background: "#F8FAFC", border: "1.5px solid #E2E8F0" }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: "#2d7a3a" }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-700 font-medium max-w-[100px] truncate">
                    {user.name.split(" ")[0]}
                  </span>
                </div>
                {confirmLogout ? (
                  <div className="flex items-center gap-1">
                    <span className="hidden sm:inline text-xs text-gray-500 font-medium mr-1">Sure?</span>
                    <button
                      onClick={handleLogoutClick}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                      aria-label="Confirm sign out"
                    >
                      <Check className="w-3.5 h-3.5" /> Yes
                    </button>
                    <button
                      onClick={() => setConfirmLogout(false)}
                      className="flex items-center px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:bg-gray-100 transition-colors"
                      aria-label="Cancel sign out"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleLogoutClick}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Sign out"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Sign out</span>
                  </button>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/auth/signin" className="btn-secondary text-sm py-2 px-3">
                  Sign in
                </Link>
                <Link href="/auth/signup" className="btn-primary text-sm py-2 px-3">
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
