"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEventHandler } from "react";
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
    const element = containerRef.current;
    if (!element) return;

    const { scrollLeft, clientWidth, scrollWidth } = element;
    setCanLeft(scrollLeft > 8);
    setCanRight(scrollLeft + clientWidth < scrollWidth - 8);
  };

  const scroll = (direction: "left" | "right") => {
    const element = containerRef.current;
    if (!element) return;

    const amount = Math.max(240, element.clientWidth * 0.76) * (direction === "left" ? -1 : 1);
    element.scrollBy({ left: amount, behavior: "smooth" });
  };

  useEffect(() => {
    const element = containerRef.current;
    updateButtons();
    if (!element) return;

    const onScroll = () => updateButtons();
    element.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateButtons);

    const observer = new MutationObserver(updateButtons);
    observer.observe(element, { childList: true, subtree: true });

    return () => {
      element.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateButtons);
      observer.disconnect();
    };
  }, []);

  const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      scroll("right");
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scroll("left");
    }
  };

  return (
    <div className="group/carousel relative">
      <div
        ref={containerRef}
        className={`flex gap-3.5 sm:gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory ${className}`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label="Carrossel horizontal"
      >
        {children}
      </div>

      {canLeft ? (
        <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 hidden w-20 bg-gradient-to-r from-[var(--background)] via-[var(--background)]/72 to-transparent md:block" />
      ) : null}

      {canRight ? (
        <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 hidden w-20 bg-gradient-to-l from-[var(--background)] via-[var(--background)]/72 to-transparent md:block" />
      ) : null}

      {canLeft ? (
        <button
          onClick={() => scroll("left")}
          aria-label="Anterior"
          className="absolute left-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white shadow-xl opacity-0 transition-all duration-250 group-hover/carousel:opacity-100 hover:border-[var(--accent-border)] hover:bg-[var(--accent)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] md:flex"
        >
          <ChevronLeft size={20} />
        </button>
      ) : null}

      {canRight ? (
        <button
          onClick={() => scroll("right")}
          aria-label="Próximo"
          className="absolute right-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white shadow-xl opacity-0 transition-all duration-250 group-hover/carousel:opacity-100 hover:border-[var(--accent-border)] hover:bg-[var(--accent)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] md:flex"
        >
          <ChevronRight size={20} />
        </button>
      ) : null}
    </div>
  );
}

