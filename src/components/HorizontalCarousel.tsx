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
    const amount = Math.max(220, el.clientWidth * 0.85) * (direction === "left" ? -1 : 1);
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  useEffect(() => {
    const el = containerRef.current;
    updateButtons();
    if (!el) return;
    const onScroll = () => updateButtons();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateButtons);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateButtons);
    };
  }, []);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className={`flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory ${className}`}
      >
        {children}
      </div>

      {canLeft && (
        <button
          onClick={() => scroll("left")}
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/70 border border-white/10 text-white items-center justify-center shadow-lg hover:bg-pink-600 transition"
          aria-label="Anterior"
        >
          <ChevronLeft size={20} />
        </button>
      )}

      {canRight && (
        <button
          onClick={() => scroll("right")}
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/70 border border-white/10 text-white items-center justify-center shadow-lg hover:bg-pink-600 transition"
          aria-label="Próximo"
        >
          <ChevronRight size={20} />
        </button>
      )}
    </div>
  );
}
