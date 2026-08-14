"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ColorBendsProps {
  className?: string;
  colors?: string[];
  speed?: number;
  density?: number;
}

function ColorBends({
  className,
  colors = ["#3f9b63", "#2f7d4d", "#57b276"],
  speed = 0.2,
  density = 1,
}: ColorBendsProps) {
  return (
    <div className={className ?? "absolute inset-0 -z-10 overflow-hidden"}>
      <Canvas>
        <Bends colors={colors} speed={speed} density={density} />
      </Canvas>
    </div>
  );
}

function Bends({ colors, speed, density }: { colors: string[]; speed: number; density: number }) {
  const meshRef = useRef<THREE.Mesh>(null);

  const gradients = useMemo(() => {
    // Spread the spheres across the viewport. `density` scales how tightly
    // packed they are (lower = more spread out).
    const spread = 4 / Math.max(density, 0.1);
    const positions: Array<[number, number, number]> = [
      [-2, 2, -3],
      [2, -1, -2],
      [0, 0, -4],
      [-1.5, -2, -3],
      [2, 1.5, -3],
    ];
    return positions.map((position, i) => ({
      color: colors[i % colors.length] || "#3f9b63",
      position: [position[0] * (spread / 4), position[1] * (spread / 4), position[2]] as [
        number,
        number,
        number,
      ],
      scale: 3 + (i % 3),
    }));
  }, [colors, density]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.elapsedTime * speed;
    meshRef.current.rotation.x = Math.sin(time * 0.1) * 0.2;
    meshRef.current.rotation.y = Math.cos(time * 0.15) * 0.3;
  });

  return (
    <>
      {/* Scene background stays null (transparent) so the CSS gradient shows through */}
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1} />

      {gradients.map((grad, i) => (
        <mesh
          key={i}
          ref={i === 0 ? meshRef : undefined}
          position={grad.position}
          scale={grad.scale}
        >
          <sphereGeometry args={[1, 64, 64]} />
          <meshStandardMaterial
            color={grad.color}
            transparent
            opacity={0.15}
            roughness={0.8}
            metalness={0.2}
          />
        </mesh>
      ))}
    </>
  );
}

export { ColorBends };
