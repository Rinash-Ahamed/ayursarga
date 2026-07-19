"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import Image from "next/image";

const DRIFTING_LEAVES = [
  [7,34,25,22,-12],[15,25,31,31,9],[26,38,28,18,-20],[37,29,34,27,15],[49,42,26,35,-8],
  [61,27,32,12,21],[72,35,29,39,-16],[83,24,36,23,12],[93,40,30,7,-22],
] as const;
type BurstLeaf = { id:number; x:number; y:number; tx:number; ty:number; rotation:number; delay:number };

export default function ParticleField() {
  const [bursts,setBursts] = useState<BurstLeaf[]>([]);
  const sequence = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onClick = (event:MouseEvent) => {
      const stamp = Date.now() + sequence.current++ * 10;
      const leaves = Array.from({length:7},(_,index) => {
        const angle = (-150 + index * 50) * Math.PI / 180;
        const distance = 55 + (index % 3) * 22;
        return {id:stamp+index,x:event.clientX,y:event.clientY,tx:Math.cos(angle)*distance,ty:Math.sin(angle)*distance+45,rotation:-90+index*43,delay:index*18};
      });
      setBursts((current) => [...current.slice(-21),...leaves]);
      window.setTimeout(() => setBursts((current) => current.filter((leaf) => !leaves.some((item) => item.id === leaf.id))),1500);
    };
    window.addEventListener("click",onClick);
    return () => window.removeEventListener("click",onClick);
  },[]);
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  return <div id="particle-canvas-wrap" aria-hidden="true"><div className="neem-drift">
    {DRIFTING_LEAVES.map(([left,size,duration,delay,rotate],index) => <Image unoptimized width={80} height={150} key={index} src="/neem-leaf.svg" alt="" className="drifting-neem" style={{"--left":`${left}%`,"--size":`${size}px`,"--duration":`${duration}s`,"--delay":`-${delay}s`,"--rotate":`${rotate}deg`} as CSSProperties}/>) }
  </div>{bursts.map((leaf) => <Image unoptimized width={80} height={150} key={leaf.id} src="/neem-leaf.svg" alt="" className="burst-neem" style={{left:leaf.x,top:leaf.y,"--tx":`${leaf.tx}px`,"--ty":`${leaf.ty}px`,"--burst-rotate":`${leaf.rotation}deg`,"--burst-delay":`${leaf.delay}ms`} as CSSProperties}/>)}</div>;
}
