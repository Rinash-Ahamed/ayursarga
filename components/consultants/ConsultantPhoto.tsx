"use client";
import { useState } from "react";
import Image from "next/image";

export function ConsultantPhoto({ name, imageUrl, size = 72 }: { name: string; imageUrl?: string | null; size?: number }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <span className="consultant-photo" aria-hidden="true">
    {imageUrl && failedUrl !== imageUrl
      ? <Image src={imageUrl} alt="" width={size} height={size} unoptimized loading="lazy" onError={() => setFailedUrl(imageUrl)} />
      : <span>{name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase()}</span>}
  </span>;
}
