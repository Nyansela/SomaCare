"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface BentoCard {
  title: string;
  description: string;
  icon?: string;
  image?: string;
  colSpan?: number;
  rowSpan?: number;
  className?: string;
}

interface MagicBentoProps {
  cards: BentoCard[];
}

export function MagicBento({ cards }: MagicBentoProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <BentoItem key={i} card={card} index={i} />
      ))}
    </div>
  );
}

function BentoItem({ card, index }: { card: BentoCard; index: number }) {
  const [imageError, setImageError] = useState(false);

  // Preload the image to detect load failures — CSS background-image fails
  // silently, so we probe with an Image() to know when to show the fallback.
  useEffect(() => {
    if (!card.image) return;
    const img = new Image();
    img.onerror = () => setImageError(true);
    img.src = card.image;
  }, [card.image]);
  
  const colSpan = card.colSpan || 1;
  const rowSpan = card.rowSpan || 1;
  
  const hasImage = card.image && !imageError;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl soma-card p-6",
        `md:col-span-${colSpan}`,
        `md:row-span-${rowSpan}`,
        card.className
      )}
      style={{
        gridColumn: `span ${colSpan}`,
        gridRow: `span ${rowSpan}`,
      }}
    >
      {/* Background Image or Gradient Fallback */}
      {hasImage ? (
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
          style={{ backgroundImage: `url(${card.image})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
        </div>
      ) : (
        <div className="absolute inset-0 soma-gradient opacity-5 group-hover:opacity-10 transition-opacity" />
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        {card.icon && (
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <span className="text-2xl">{card.icon}</span>
          </div>
        )}
        
        <h3 className="font-display text-xl font-semibold">{card.title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{card.description}</p>
      </div>

      {/* Hover Glow */}
      <div className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 via-transparent to-primary/20 blur-xl" />
      </div>
    </motion.div>
  );
}

// Helper function to get placeholder image paths
export function getFeatureImagePath(feature: string): string {
  const imageMap: Record<string, string> = {
    "health-vault": "/images/landing/feature-vault.jpg",
    "ai-chat": "/images/landing/feature-ai-chat.jpg",
    "vitals": "/images/landing/feature-vitals.jpg",
    "wellness": "/images/landing/feature-wellness.jpg",
    "schedule": "/images/landing/feature-schedule.jpg",
    "medverify": "/images/landing/feature-medverify.jpg",
  };
  return imageMap[feature] || "";
}
