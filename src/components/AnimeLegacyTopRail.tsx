"use client";

import Link from "next/link";

type TrailItem = {
  label: string;
  href?: string;
};

type RailAction = {
  label: string;
  href?: string;
};

export default function AnimeLegacyTopRail({
  trail,
  actions = [],
}: {
  trail: TrailItem[];
  actions?: RailAction[];
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/55 backdrop-blur-md overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
      <div className="h-9 px-3 sm:px-4 flex items-center text-[11px] sm:text-xs text-zinc-400 overflow-x-auto whitespace-nowrap scrollbar-hide">
        {trail.map((item, index) => {
          const isLast = index === trail.length - 1;
          return (
            <span key={`${item.label}-${index}`} className="inline-flex items-center">
              {item.href && !isLast ? (
                <Link prefetch={true} href={item.href} className="hover:text-white transition font-semibold">
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? "text-white font-bold" : "font-semibold"}>{item.label}</span>
              )}
              {!isLast && <span className="mx-1.5 text-zinc-600">»</span>}
            </span>
          );
        })}
      </div>

      {actions.length > 0 && (
        <div className="h-10 px-2 sm:px-3 border-t border-white/10 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-hide">
          {actions.map((action) => (
            <Link
              prefetch={true}
              key={`${action.label}-${action.href || "#"}`}
              href={action.href || "#"}
              className="h-7 px-2.5 rounded-md text-[11px] font-black transition border border-white/10 bg-white/[0.03] text-zinc-300 hover:text-white hover:bg-white/10"
            >
              {action.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
