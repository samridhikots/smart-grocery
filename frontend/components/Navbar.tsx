"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, LayoutDashboard, PlusCircle, Star, BarChart2, Lightbulb, Leaf } from "lucide-react";

const links = [
  { href: "/",                label: "Home",            icon: ShoppingCart },
  { href: "/dashboard",       label: "Dashboard",       icon: LayoutDashboard },
  { href: "/add",             label: "Add Purchase",    icon: PlusCircle },
  { href: "/recommendations", label: "Recommendations", icon: Star },
  { href: "/insights",        label: "Insights",        icon: Lightbulb },
  { href: "/sustainability",  label: "Sustainability",  icon: Leaf },
  { href: "/comparison",      label: "Model Comparison",icon: BarChart2 },
];

export default function Navbar() {
  const pathname = usePathname();
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-green-700 text-lg">
            <ShoppingCart className="w-6 h-6" />
            SmartGrocery
          </Link>
          <div className="flex items-center gap-1">
            {links.map(({ href, label, icon: Icon }) => (
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
                <span className="hidden lg:inline">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
