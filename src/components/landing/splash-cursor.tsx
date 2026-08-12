"use client";

import { useEffect, useRef, useCallback } from "react";
import gsap from "gsap";

interface SplashCursorProps {
  color?: string;
  size?: number;
  roughness?: number;
}

export function SplashCursor({ color = "#8b5cf6", size = 25, roughness = 0.2 }: SplashCursorProps) {
  const cursorRef = useRef<HTMLDivElement>(null);
  const hooks = useRef<HTMLDivElement[]>([]);

  const addHook = useCallback((el: HTMLDivElement | null) => {
    if (el && !hooks.current.includes(el)) {
      hooks.current.push(el);
    }
  }, []);

  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;

    const onMouseMove = (e: MouseEvent) => {
      gsap.to(cursor, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.5,
        ease: "power3.out",
      });

      hooks.current.forEach((hook, i) => {
        const rect = hook.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distance = Math.sqrt(
          Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2),
        );
        const maxDistance = 200;
        const scale = Math.max(0, 1 - distance / maxDistance);

        gsap.to(hook, {
          scale: 1 + scale * 0.5,
          opacity: 0.3 + scale * 0.7,
          duration: 0.3,
          ease: "power2.out",
        });
      });
    };

    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  return (
    <>
      <div
        ref={cursorRef}
        className="pointer-events-none fixed left-0 top-0 z-50 rounded-full mix-blend-screen"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
          transform: "translate(-50%, -50%)",
        }}
      />
      <div
        ref={addHook}
        className="splash-hook fixed inset-0 pointer-events-none z-[49]"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${color} 0%, transparent 50%)`,
          opacity: 0,
        }}
      />
    </>
  );
}
