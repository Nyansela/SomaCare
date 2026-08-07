"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { easing } from "maath";

function ColorBends() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <Canvas>
        <Bends />
      </Canvas>
    </div>
  );
}

function Bends() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const gradients = useMemo(() => {
    return [
      { color: "#8b5cf6", position: [-2, 2, -3] as [number, number, number], scale: 4 },
      { color: "#ec4899", position: [2, -1, -2] as [number, number, number], scale: 3 },
      { color: "#06b6d4", position: [0, 0, -4] as [number, number, number], scale: 5 },
      { color: "#10b981", position: [-1.5, -2, -3] as [number, number, number], scale: 3.5 },
      { color: "#f59e0b", position: [2, 1.5, -3] as [number, number, number], scale: 3 },
    ];
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.elapsedTime;
    meshRef.current.rotation.x = Math.sin(time * 0.1) * 0.2;
    meshRef.current.rotation.y = Math.cos(time * 0.15) * 0.3;
  });

  return (
    <>
      <color attach="background" args={["#0a0a0f"]} />
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
      
      <mesh position={[0, 0, -8]} scale={20}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#0a0a0f" />
      </mesh>
    </>
  );
}

export { ColorBends };
