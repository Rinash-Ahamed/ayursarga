"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { hospitalImageSrcSet } from "@/features/hospitals/images";

async function decodeGalleryImage(url: string, sizes: string, priority: "auto" | "low" = "auto") {
  const image = new window.Image();
  image.decoding = "async";
  image.fetchPriority = priority;
  image.referrerPolicy = "no-referrer";
  const srcSet = hospitalImageSrcSet(url);
  if (srcSet) {
    image.sizes = sizes;
    image.srcset = srcSet;
  }
  image.src = url;
  await image.decode();
}

/** Keep the current photo visible while its replacement downloads and decodes. */
export function useHospitalImageGallery(source: string[], sizes: string, preloadNext = true) {
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [loadedImageUrl, setLoadedImageUrl] = useState<string | null>(null);
  const [direction, setDirection] = useState<"previous" | "next" | "initial">("initial");
  const navigationRequest = useRef(0);
  const pendingDecodes = useRef(new Map<string, Promise<void>>());
  const images = source.filter((url) => !failedImages.includes(url));
  const displayedIndex = Math.max(0, images.indexOf(selectedUrl ?? ""));
  const imageUrl = images[displayedIndex];
  const nextUrl = images.length > 1 ? images[(displayedIndex + 1) % images.length] : undefined;

  useEffect(() => () => { navigationRequest.current += 1; }, []);

  const decode = useCallback((url: string, priority: "auto" | "low" = "auto") => {
    // Coalesce a quick second tap or navigation during an adjacent-photo preload.
    // Keep only in-flight work; the browser owns the immutable response cache.
    const key = `${url}\n${sizes}\n${window.innerWidth}\n${window.devicePixelRatio}`;
    const pending = pendingDecodes.current;
    const existing = pending.get(key);
    if (existing) return existing;
    const request = decodeGalleryImage(url, sizes, priority).finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
  }, [sizes]);

  useEffect(() => {
    if (!preloadNext || !nextUrl || loadedImageUrl !== imageUrl) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || connection?.effectiveType?.includes("2g")) return;
    // One adjacent photo only; never fetch every gallery image on page load.
    void decode(nextUrl, "low").catch(() => undefined);
  }, [imageUrl, loadedImageUrl, nextUrl, preloadNext, decode]);

  function failImage(url: string) {
    setFailedImages((current) => current.includes(url) ? current : [...current, url]);
  }

  async function showImage(index: number, slideDirection: "previous" | "next" = "next") {
    const targetUrl = images[index];
    if (!targetUrl) return;
    const requestId = ++navigationRequest.current;
    if (targetUrl === imageUrl) return;
    try {
      await decode(targetUrl);
      if (navigationRequest.current !== requestId) return;
      setDirection(slideDirection);
      setLoadedImageUrl(targetUrl);
      setSelectedUrl(targetUrl);
    } catch {
      if (navigationRequest.current === requestId) failImage(targetUrl);
    }
  }

  return { images, imageUrl, displayedIndex, direction, loadedImageUrl, markLoaded: setLoadedImageUrl, failImage, showImage };
}
