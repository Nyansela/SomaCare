"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface MenuItem {
  label: string;
  href: string;
  description?: string;
}

interface FlowingMenuProps {
  items: MenuItem[];
  backgroundImage?: string;
}

export function FlowingMenu({ items, backgroundImage }: FlowingMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        Explore
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </button>

      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{
          opacity: isOpen ? 1 : 0,
          y: isOpen ? 0 : 10,
          scale: isOpen ? 1 : 0.95,
        }}
        transition={{ duration: 0.2 }}
        className="absolute left-0 top-full mt-2 w-64 overflow-hidden rounded-xl soma-card shadow-xl"
        style={{ pointerEvents: isOpen ? "auto" : "none" }}
      >
        {/* Background Image */}
        {backgroundImage && (
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-20"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          />
        )}

        <div className="relative z-10 p-2">
          {items.map((item, i) => (
            <motion.a
              key={item.label}
              href={item.href}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="block rounded-lg p-3 transition-colors hover:bg-accent"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="font-medium text-sm">{item.label}</div>
              {item.description && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {item.description}
                </div>
              )}
            </motion.a>
          ))}
        </div>

        {/* Hover glow effect */}
        {hoveredIndex !== null && (
          <motion.div
            className="absolute inset-0 bg-primary/5 pointer-events-none rounded-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </motion.div>
    </div>
  );
}
