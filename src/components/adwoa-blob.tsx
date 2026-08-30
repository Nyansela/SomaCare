import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * 3D animated blob for Adwoa's live voice conversation mode.
 * Uses a custom Perlin-noise vertex shader to create an organic,
 * morphing sphere that reacts to the conversation phase.
 *
 * Colors are theme-aware — they adapt to the CSS accent color at runtime.
 */

const vertexShader = `
uniform float u_intensity;
uniform float u_time;

varying vec2 vUv;
varying float vDisplacement;

// Classic Perlin 3D Noise functions
vec4 permute(vec4 x) {
    return mod(((x*34.0)+1.0)*x, 289.0);
}

vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
}

vec3 fade(vec3 t) {
    return t*t*t*(t*(t*6.0-15.0)+10.0);
}

float cnoise(vec3 P) {
    vec3 Pi0 = floor(P);
    vec3 Pi1 = Pi0 + vec3(1.0);
    Pi0 = mod(Pi0, 289.0);
    Pi1 = mod(Pi1, 289.0);
    vec3 Pf0 = fract(P);
    vec3 Pf1 = Pf0 - vec3(1.0);
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
    vec4 iy = vec4(Pi0.yy, Pi1.yy);
    vec4 iz0 = Pi0.zzzz;
    vec4 iz1 = Pi1.zzzz;

    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = permute(ixy + iz0);
    vec4 ixy1 = permute(ixy + iz1);

    vec4 gx0 = ixy0 / 7.0;
    vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
    gx0 = fract(gx0);
    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
    vec4 sz0 = step(gz0, vec4(0.0));
    gx0 -= sz0 * (step(0.0, gx0) - 0.5);
    gy0 -= sz0 * (step(0.0, gy0) - 0.5);

    vec4 gx1 = ixy1 / 7.0;
    vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
    gx1 = fract(gx1);
    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
    vec4 sz1 = step(gz1, vec4(0.0));
    gx1 -= sz1 * (step(0.0, gx1) - 0.5);
    gy1 -= sz1 * (step(0.0, gy1) - 0.5);

    vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
    vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
    vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
    vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
    vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
    vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
    vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
    vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

    vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
    g000 *= norm0.x;
    g010 *= norm0.y;
    g100 *= norm0.z;
    g110 *= norm0.w;
    vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
    g001 *= norm1.x;
    g011 *= norm1.y;
    g101 *= norm1.z;
    g111 *= norm1.w;

    float n000 = dot(g000, Pf0);
    float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
    float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
    float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
    float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
    float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
    float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
    float n111 = dot(g111, Pf1);

    vec3 fade_xyz = fade(Pf0);
    vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
    float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
    return 2.2 * n_xyz;
}

void main() {
    vUv = uv;

    vDisplacement = cnoise(position + vec3(0.8 * u_time));

    vec3 newPosition = position + normal * (u_intensity * vDisplacement * 0.6);

    vec4 modelPosition = modelMatrix * vec4(newPosition, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;

    gl_Position = projectedPosition;
}
`;

const fragmentShader = `
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform float u_time;

varying vec2 vUv;
varying float vDisplacement;

void main() {
    // Gradient based on displacement + UV for organic feel
    float mixFactor = (vDisplacement + 1.0) * 0.5;
    vec3 color = mix(u_color1, u_color2, mixFactor);

    // Subtle shimmer — breathing effect
    float shimmer = sin(vUv.x * 6.28 + u_time * 0.2) * 0.04 + 0.96;
    color *= shimmer;

    // Soft rim glow
    float rim = pow(1.0 - abs(vUv.x - 0.5) * 2.0, 3.0) * 0.08;
    color += rim;

    gl_FragColor = vec4(color, 1.0);
}
`;

type BlobPhase = "idle" | "listening" | "thinking" | "speaking";

/**
 * Read the app's CSS accent color (--primary) from the DOM so the blob
 * adapts to whichever theme preset the user selected.
 */
function getAccentColors(): { primary: string; secondary: string } {
  if (typeof document === "undefined") return { primary: "#6366f1", secondary: "#a78bfa" };
  const style = getComputedStyle(document.documentElement);
  const h = style.getPropertyValue("--primary").trim();
  // --primary is typically an HSL triplet like "255 100% 60%"
  if (h) {
    const parts = h.split(/\s+/).map(Number);
    if (parts.length >= 3) {
      const [hue, sat, light] = parts;
      const c1 = `hsl(${hue}, ${sat}%, ${Math.min(light + 10, 95)}%)`;
      const c2 = `hsl(${hue}, ${Math.max(sat - 15, 20)}%, ${Math.max(light - 15, 15)}%)`;
      return { primary: c1, secondary: c2 };
    }
  }
  return { primary: "#6366f1", secondary: "#a78bfa" };
}

function hslToRgb(hsl: string): [number, number, number] {
  // Parse hsl(h, s%, l%) or fallback to hex
  const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return hexToRgb(hsl.startsWith("#") ? hsl : "#6366f1");
  const h = parseInt(match[1]) / 360;
  const s = parseInt(match[2]) / 100;
  const l = parseInt(match[3]) / 100;

  if (s === 0) return [l, l, l];

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
}

/** Phase-specific color overrides — uses accent for idle, distinct hues for others */
const PHASE_COLORS: Record<BlobPhase, { color1: string; color2: string; intensity: number }> = {
  idle:       { color1: "", color2: "", intensity: 0.15 },       // filled dynamically
  listening:  { color1: "#22c55e", color2: "#86efac", intensity: 0.35 },
  thinking:   { color1: "#6366f1", color2: "#a78bfa", intensity: 0.22 },
  speaking:   { color1: "#8b5cf6", color2: "#c084fc", intensity: 0.45 },
};

function getPhaseColors(phase: BlobPhase) {
  const accent = getAccentColors();
  const base = PHASE_COLORS[phase];
  if (phase === "idle") {
    return { ...base, color1: accent.primary, color2: accent.secondary };
  }
  return base;
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

function BlobMesh({ phase }: { phase: BlobPhase }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const config = getPhaseColors(phase);

  const uniforms = useMemo(
    () => ({
      u_intensity: { value: config.intensity },
      u_time: { value: 0 },
      u_color1: { value: new THREE.Color(...(phase === "idle" ? hslToRgb(config.color1) : hexToRgb(config.color1))) },
      u_color2: { value: new THREE.Color(...(phase === "idle" ? hslToRgb(config.color2) : hexToRgb(config.color2))) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (materialRef.current) {
      materialRef.current.uniforms.u_time.value = t * 0.6;
      // Smoothly interpolate intensity
      const target = getPhaseColors(phase).intensity;
      const current = materialRef.current.uniforms.u_intensity.value;
      materialRef.current.uniforms.u_intensity.value += (target - current) * 0.04;
      // Smoothly interpolate colors
      const c = getPhaseColors(phase);
      const c1 = new THREE.Color(...(phase === "idle" ? hslToRgb(c.color1) : hexToRgb(c.color1)));
      const c2 = new THREE.Color(...(phase === "idle" ? hslToRgb(c.color2) : hexToRgb(c.color2)));
      materialRef.current.uniforms.u_color1.value.lerp(c1, 0.025);
      materialRef.current.uniforms.u_color2.value.lerp(c2, 0.025);
    }
    // Slow, gentle rotation
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.04;
      meshRef.current.rotation.x = Math.sin(t * 0.03) * 0.05;
    }
  });

  return (
    <mesh ref={meshRef} scale={1.6}>
      <icosahedronGeometry args={[1, 64]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

/**
 * AdwoaBlob — animated 3D blob for the voice conversation overlay.
 * Renders in a lightweight canvas; respects reduced-motion via CSS.
 *
 * Phase color mapping:
 *  - idle:      accent/theme color (subtle breathing)
 *  - listening: green (active, receptive)
 *  - thinking:  indigo (AI processing)
 *  - speaking:  purple (outputting voice)
 */
export function AdwoaBlob({ phase = "idle" }: { phase?: BlobPhase }) {
  return (
    <div className="h-full w-full">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={0.6} />
        <BlobMesh phase={phase} />
      </Canvas>
    </div>
  );
}
