"use client";

import { useState, useRef, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href: string;
}

interface GooeyNavProps {
  items: NavItem[];
  logo?: { text?: string; image?: string; href: string };
  cta?: { label: string; href: string };
}

export function GooeyNav({ items, logo, cta }: GooeyNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState({ left: 0, width: 0 });
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updatePosition = () => {
      const nav = navRef.current;
      if (!nav) return;

      const activeItem = nav.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement;
      if (activeItem) {
        setPosition({
          left: activeItem.offsetLeft,
          width: activeItem.offsetWidth,
        });
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [activeIndex, isOpen]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
      <nav ref={navRef} className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        {logo && (
          <Link to={logo.href} className="flex items-center gap-2 z-50">
            {logo.image ? (
              <img src={logo.image} alt="SomaCare Logo" className="h-9 w-auto" />
            ) : (
              <>
                <div className="grid h-9 w-9 place-items-center rounded-xl soma-gradient soma-glow">
                  <svg
                    className="h-5 w-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                </div>
                <span className="font-display text-lg font-bold tracking-tight">{logo.text}</span>
              </>
            )}
          </Link>
        )}

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1 relative">
          {items.map((item, i) => (
            <Link
              key={item.label}
              data-index={i}
              to={item.href}
              onMouseEnter={() => setActiveIndex(i)}
              className={`relative px-4 py-2 text-sm font-medium transition-colors ${
                activeIndex === i
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
              {activeIndex === i && (
                <motion.div
                  layoutId="nav-glow"
                  className="absolute inset-0 -z-10 rounded-full bg-primary/10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </Link>
          ))}
        </div>

        {/* CTA */}
        {cta && (
          <div className="hidden md:block">
            <Link to={cta.href}>
              <Button size="sm" className="soma-gradient soma-glow border-0">
                {cta.label}
              </Button>
            </Link>
          </div>
        )}

        {/* Mobile Toggle */}
        <button
          className="md:hidden z-50 p-2"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>

        {/* Mobile Menu */}
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed inset-0 top-[72px] bg-background/95 backdrop-blur-lg p-6 md:hidden"
          >
            <div className="flex flex-col gap-4">
              {items.map((item, i) => (
                <Link
                  key={item.label}
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-3 text-lg font-medium hover:text-primary transition-colors"
                >
                  {item.label}
                </Link>
              ))}
              {cta && (
                <Link to={cta.href} onClick={() => setIsOpen(false)} className="mt-4">
                  <Button className="w-full soma-gradient soma-glow border-0">{cta.label}</Button>
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </nav>
    </header>
  );
}
