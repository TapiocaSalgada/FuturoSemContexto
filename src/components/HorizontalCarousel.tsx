"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  children: React.ReactNode;
  className?: string;
}

export default function HorizontalCarousel({ children, className = "" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateButtons = () => {
    const el = containerRef.current;
    if (!el) return;
    const { scrollLeft, clientWidth, scrollWidth } = el;
    setCanLeft(scrollLeft > 8);
    setCanRight(scrollLeft + clientWidth < scrollWidth - 8);
  };

  const scroll = (direction: "left" | "right") => {
    const el = containerRef.current;
    if (!el) return;
    const amount = Math.max(220, el.clientWidth * 0.74) * (direction === "left" ? -1 : 1);
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  useEffect(() => {
    const el = containerRef.current;
    updateButtons();
    if (!el) return;

    const onScroll = () => updateButtons();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateButtons);

    // Observe children changes
    const observer = new MutationObserver(updateButtons);
    observer.observe(el, { childList: true, subtree: true });

    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateButtons);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="relative group/carousel">
      <div
        ref={containerRef}
        className={`flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory ${className}`}
      >
        {children}
      </div>

      {/* Left fade */}
      {canLeft && (
        <div className="hidden md:block absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[var(--background)] to-transparent pointer-events-none z-10" />
      )}

      {/* Right fade */}
      {canRight && (
        <div className="hidden md:block absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[var(--background)] to-transparent pointer-events-none z-10" />
      )}

      {canLeft && (
        <button
          onClick={() => scroll("left")}
          className="hidden md:flex absolute left-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-white/18 bg-black/70 text-white items-center justify-center shadow-xl opacity-0 group-hover/carousel:opacity-100 transition-all duration-300 hover:bg-red-600 hover:border-red-400 z-20"
          aria-label="Anterior"
        >
          <ChevronLeft size={20} />
        </button>
      )}

      {canRight && (
        <button
          onClick={() => scroll("right")}
          className="hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-white/18 bg-black/70 text-white items-center justify-center shadow-xl opacity-0 group-hover/carousel:opacity-100 transition-all duration-300 hover:bg-red-600 hover:border-red-400 z-20"
          aria-label="Próximo"
        >
          <ChevronRight size={20} />
        </button>
      )}
    </div>
  );
}
