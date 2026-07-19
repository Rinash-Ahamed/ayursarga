"use client";

import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

type Tier = "near" | "far";

interface ParticleData {
  x: number;
  y: number;
  z: number;
  size: number;
  speed: number;
  driftAmp: number;
  phase: number;
  rotation: number;
  rotSpeed: number;
  sway: number;
  diagonal: number;
}

function makeParticles(
  count: number,
  spreadX: number,
  spreadY: number,
  tier: Tier
): ParticleData[] {
  const depthFactor = tier === "near" ? 1 : 0.55;
  return Array.from({ length: count }, () => ({
    x: (Math.random() - 0.5) * spreadX,
    y: (Math.random() * 1.4 - 0.2) * spreadY,
    z: tier === "near" ? Math.random() * 0.6 : -1.2 - Math.random() * 1.6,
    size: (0.16 + Math.random() * 0.3) * depthFactor,
    speed: (0.025 + Math.random() * 0.055) * (0.5 + depthFactor * 0.45),
    driftAmp: 0.15 + Math.random() * 0.35,
    phase: Math.random() * Math.PI * 2,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.18,
    sway: 0.35 + Math.random() * 0.65,
    diagonal: (Math.random() - 0.5) * 0.18,
  }));
}

function InstancedGroup({
  count,
  spreadX,
  spreadY,
  tier,
  colorA,
  colorB,
  shape,
  opacity,
}: {
  count: number;
  spreadX: number;
  spreadY: number;
  tier: Tier;
  colorA: string;
  colorB: string;
  shape: "neem" | "mint" | "herb" | "clove";
  opacity: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const windSeed = useMemo(() => Math.random() * 1000, []);
  const particles = useMemo(
    () => makeParticles(count, spreadX, spreadY, tier),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count, tier]
  );

  const geometry = useMemo(() => {
    if (shape === "neem") {
      const s = new THREE.Shape();
      s.moveTo(0, -0.62);
      s.bezierCurveTo(0.26, -0.3, 0.25, 0.34, 0, 0.66);
      s.bezierCurveTo(-0.25, 0.34, -0.26, -0.3, 0, -0.62);
      return new THREE.ShapeGeometry(s);
    }
    if (shape === "mint") {
      const s = new THREE.Shape();
      s.moveTo(0, -0.5);
      s.bezierCurveTo(0.56, -0.42, 0.58, 0.24, 0, 0.58);
      s.bezierCurveTo(-0.58, 0.24, -0.56, -0.42, 0, -0.5);
      return new THREE.ShapeGeometry(s);
    }
    if (shape === "clove") {
      const s = new THREE.Shape();
      s.moveTo(-0.12, -0.58);
      s.lineTo(0.12, -0.58);
      s.lineTo(0.18, 0.2);
      s.bezierCurveTo(0.52, 0.24, 0.5, 0.6, 0, 0.64);
      s.bezierCurveTo(-0.5, 0.6, -0.52, 0.24, -0.18, 0.2);
      s.closePath();
      return new THREE.ShapeGeometry(s);
    }
    const s = new THREE.Shape();
    s.moveTo(0, -0.7);
    s.bezierCurveTo(0.18, -0.28, 0.2, 0.34, 0, 0.7);
    s.bezierCurveTo(-0.2, 0.34, -0.18, -0.28, 0, -0.7);
    return new THREE.ShapeGeometry(s);
  }, [shape]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const c1 = new THREE.Color(colorA);
    const c2 = new THREE.Color(colorB);
    particles.forEach((_, i) => {
      const c = c1.clone().lerp(c2, Math.random());
      mesh.setColorAt(i, c);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [particles, colorA, colorB]);

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    const pointer = state.pointer;
    const windInfluence = Math.sin(t * 0.12 + windSeed) * 0.5 + 0.5;
    const d = Math.min(delta, 0.05);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const vx =
        0.012 * windInfluence +
        Math.sin(t * 0.28 * p.sway + p.phase) * p.driftAmp * 0.012 +
        p.diagonal * 0.018;

      p.x += vx * d * 6 * p.sway;
      p.y -= p.speed * d * 6;
      p.rotation += p.rotSpeed * d;

      if (p.y < -spreadY * 0.7) {
        p.y = spreadY * 0.9;
        p.x = (Math.random() - 0.5) * spreadX;
      }
      if (p.x < -spreadX * 0.6) p.x = spreadX * 0.6;
      if (p.x > spreadX * 0.6) p.x = -spreadX * 0.6;

      const depthMix = tier === "near" ? 1 : 0.4;
      dummy.position.set(
        p.x + pointer.x * 0.35 * depthMix,
        p.y + pointer.y * 0.22 * depthMix,
        p.z
      );
      dummy.rotation.z = p.rotation;
      dummy.scale.setScalar(p.size);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined as unknown as THREE.Material, count]}
      frustumCulled={false}
    >
      <meshBasicMaterial
        transparent
        opacity={opacity}
        vertexColors
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
}

function Scene() {
  const { viewport } = useThree();
  const w = Math.max(viewport.width, 8);
  const h = Math.max(viewport.height, 8);

  return (
    <>
      <InstancedGroup count={6} spreadX={w} spreadY={h} tier="far" colorA="#59664A" colorB="#788266" shape="neem" opacity={0.2} />
      <InstancedGroup count={5} spreadX={w} spreadY={h} tier="near" colorA="#5F7653" colorB="#839273" shape="mint" opacity={0.32} />
      <InstancedGroup count={5} spreadX={w} spreadY={h} tier="far" colorA="#78805E" colorB="#A08E65" shape="herb" opacity={0.18} />
      <InstancedGroup count={4} spreadX={w} spreadY={h} tier="near" colorA="#624A38" colorB="#8B6548" shape="clove" opacity={0.3} />
    </>
  );
}

export default function ParticleField() {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduced) return null;

  return (
    <div id="particle-canvas-wrap">
      <Canvas
        dpr={[0.85, 1.25]}
        gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 5], fov: 50 }}
        resize={{ debounce: { scroll: 0, resize: 120 } }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
