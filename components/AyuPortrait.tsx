import Image from "next/image";

// Reuse the small, locally served mascot in both surfaces; depth is CSS-only.
export default function AyuPortrait({ compact = false }: { compact?: boolean }) {
  const size = compact ? 56 : 72;
  return <span className="ayu-buddy-portrait" aria-hidden="true">
    <Image src="/ayu-buddy.webp" alt="" width={size} height={compact ? 55 : 71} sizes={`${size}px`} unoptimized />
  </span>;
}
