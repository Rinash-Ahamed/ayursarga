"use client";

import { preload } from "react-dom";

/** Keeps the hero poster high priority without making every portal route fetch it. */
export default function HeroPosterPreload() {
  preload("/hero-video-poster.webp", { as: "image", fetchPriority: "high" });
  return null;
}
