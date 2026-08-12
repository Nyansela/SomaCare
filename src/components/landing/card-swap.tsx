"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CardItem {
  id: string;
  title: string;
  subtitle?: string;
  content: string;
  author?: string;
  role?: string;
}

interface CardSwapProps {
  cards: CardItem[];
  autoPlay?: boolean;
  interval?: number;
}

export function CardSwap({ cards, autoPlay = true, interval = 5000 }: CardSwapProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const next = useCallback(() => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  }, [cards.length]);

  const prev = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  useEffect(() => {
    if (autoPlay) {
      intervalRef.current = setInterval(next, interval);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoPlay, interval, next]);

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
      rotate: dir > 0 ? 10 : -10,
    }),
    center: {
      x: 0,
      opacity: 1,
      rotate: 0,
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 300 : -300,
      opacity: 0,
      rotate: dir < 0 ? 10 : -10,
    }),
  };

  return (
    <div className="relative max-w-2xl mx-auto">
      <div className="relative h-[300px] overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute inset-0"
          >
            <div className="soma-card p-8 h-full flex flex-col justify-center">
              <Quote className="h-8 w-8 text-primary/30 mb-4" />
              <p className="text-lg text-foreground mb-6 leading-relaxed">
                {cards[currentIndex].content}
              </p>
              <div>
                <div className="font-semibold">
                  {cards[currentIndex].author || cards[currentIndex].title}
                </div>
                {cards[currentIndex].role && (
                  <div className="text-sm text-muted-foreground">{cards[currentIndex].role}</div>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 mt-6">
        <Button variant="outline" size="icon" onClick={prev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex gap-2">
          {cards.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setDirection(i > currentIndex ? 1 : -1);
                setCurrentIndex(i);
              }}
              className={`h-2 rounded-full transition-all ${
                i === currentIndex ? "w-8 bg-primary" : "w-2 bg-muted"
              }`}
            />
          ))}
        </div>
        <Button variant="outline" size="icon" onClick={next}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
