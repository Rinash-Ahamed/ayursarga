"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";

const FILMS = [
  "/video/ayurvedic-treatment-web.mp4",
  "/video/ayur2-web.mp4",
  "/video/babycare-web.mp4",
] as const;

type VideoSlot = 0 | 1;

function prepareVideo(video: HTMLVideoElement | null, index: number) {
  if (!video || video.getAttribute("src") === FILMS[index]) return;
  video.preload = "auto";
  video.poster = "/video/treatment-poster.webp";
  video.src = FILMS[index];
  video.load();
}

export default function TreatmentFilm() {
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const firstVideoRef = useRef<HTMLVideoElement>(null);
  const secondVideoRef = useRef<HTMLVideoElement>(null);
  const inView = useRef(false);
  const activeSlotRef = useRef<VideoSlot>(0);
  const filmIndexRef = useRef(0);
  const transitioning = useRef(false);
  const transitionTimer = useRef<number | null>(null);
  const [activeSlot, setActiveSlot] = useState<VideoSlot>(0);
  const [failedSlot, setFailedSlot] = useState<VideoSlot | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;
    const prepareLeadMedia = () => prepareVideo(activeSlotRef.current === 0 ? firstVideoRef.current : secondVideoRef.current, filmIndexRef.current);
    const playVisibleMedia = () => {
      const activeVideo = activeSlotRef.current === 0 ? firstVideoRef.current : secondVideoRef.current;
      if (!inView.current || document.hidden || media.matches) {
        firstVideoRef.current?.pause();
        secondVideoRef.current?.pause();
        return;
      }
      prepareLeadMedia();
      void activeVideo?.play().catch(() => undefined);
    };

    const preloadObserver = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || document.hidden) return;
      prepareLeadMedia();
      preloadObserver.disconnect();
    }, { threshold: 0, rootMargin: "600px 0px" });

    const playbackObserver = new IntersectionObserver(([entry]) => {
      inView.current = entry.isIntersecting;
      playVisibleMedia();
    }, { threshold: .01, rootMargin: "0px" });
    preloadObserver.observe(container);
    playbackObserver.observe(container);
    document.addEventListener("visibilitychange", playVisibleMedia);
    return () => {
      inView.current = false;
      preloadObserver.disconnect();
      playbackObserver.disconnect();
      document.removeEventListener("visibilitychange", playVisibleMedia);
      firstVideoRef.current?.pause();
      secondVideoRef.current?.pause();
      if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
      transitioning.current = false;
    };
  }, [reducedMotion]);

  const startedPlaying = (slot: VideoSlot) => {
    setFailedSlot(null);
    // Let the first frame play before the following film competes for bandwidth.
    if (slot !== activeSlotRef.current || !inView.current || document.hidden) return;
    prepareVideo(slot === 0 ? secondVideoRef.current : firstVideoRef.current, (filmIndexRef.current + 1) % FILMS.length);
  };

  const advanceFilm = async (completedSlot: VideoSlot) => {
    if (completedSlot !== activeSlotRef.current || transitioning.current || !inView.current) return;
    transitioning.current = true;

    const nextSlot: VideoSlot = completedSlot === 0 ? 1 : 0;
    const nextIndex = (filmIndexRef.current + 1) % FILMS.length;
    const nextVideo = nextSlot === 0 ? firstVideoRef.current : secondVideoRef.current;
    const completedVideo = completedSlot === 0 ? firstVideoRef.current : secondVideoRef.current;

    if (!nextVideo) {
      transitioning.current = false;
      return;
    }

    prepareVideo(nextVideo, nextIndex);
    if (nextVideo.readyState > 0) nextVideo.currentTime = 0;
    try {
      await nextVideo.play();
      if (!inView.current || document.hidden) {
        nextVideo.pause();
        transitioning.current = false;
        return;
      }
      filmIndexRef.current = nextIndex;
      activeSlotRef.current = nextSlot;
      setActiveSlot(nextSlot);

      transitionTimer.current = window.setTimeout(() => {
        completedVideo?.pause();
        if (inView.current && !document.hidden) prepareVideo(completedVideo, (nextIndex + 1) % FILMS.length);
        transitioning.current = false;
      }, 950);
    } catch {
      transitioning.current = false;
    }
  };

  return <motion.div ref={containerRef} className="treatment-film" initial={reducedMotion ? false : { opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, amount: .12 }} transition={{ duration: reducedMotion ? 0 : .45, ease: [0.22, 1, 0.36, 1] }}>
    <Image className="treatment-film-poster" src="/video/treatment-poster.webp" alt="" fill unoptimized loading="lazy" />
    <video ref={firstVideoRef} className={`treatment-film-video${activeSlot === 0 && failedSlot !== 0 ? " active" : ""}`} muted playsInline preload="none" aria-label="Traditional Ayurvedic treatment experience" onPlaying={() => startedPlaying(0)} onError={() => { if (activeSlotRef.current === 0) setFailedSlot(0); }} onEnded={() => void advanceFilm(0)} />
    <video ref={secondVideoRef} className={`treatment-film-video${activeSlot === 1 && failedSlot !== 1 ? " active" : ""}`} muted playsInline preload="none" aria-hidden={activeSlot !== 1} onPlaying={() => startedPlaying(1)} onError={() => { if (activeSlotRef.current === 1) setFailedSlot(1); }} onEnded={() => void advanceFilm(1)} />
    <div className="treatment-film-shade" />
    <div className="treatment-film-copy"><span>The practice</span><h3>Ancient care, thoughtfully experienced.</h3><p>A glimpse into the therapies, attention and unhurried rhythm behind an Ayurvedic retreat.</p></div>
  </motion.div>;
}
