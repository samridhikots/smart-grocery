"use client";
import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export default function EmptyState({ icon: Icon, title, message, ctaLabel, ctaHref }: EmptyStateProps) {
  return (
    <div className="card flex flex-col items-center text-center py-16 px-6 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: "var(--green-light)" }}>
        <Icon className="w-8 h-8" style={{ color: "var(--green-primary)" }} />
      </div>
      <h3 className="text-base font-semibold text-gray-800 mb-1">{title}</h3>
      <p className="text-sm text-gray-400 max-w-xs leading-relaxed mb-6">{message}</p>
      {ctaLabel && ctaHref && (
        <Link href={ctaHref} className="btn-primary text-sm">
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
