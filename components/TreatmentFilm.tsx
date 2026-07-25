"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import MagneticButton from "./MagneticButton";

const FILMS = [
  "/video/ayurvedic-treatment.mp4",
  "/video/ayur2.mp4",
  "/video/babycare.mp4",
] as const;

type VideoSlot = 0 | 1;

export default function TreatmentFilm() {
  const containerRef = useRef<HTMLDivElement>(null);
  const firstVideoRef = useRef<HTMLVideoElement>(null);
  const secondVideoRef = useRef<HTMLVideoElement>(null);
  const userPaused = useRef(false);
  const inView = useRef(false);
  const activeSlotRef = useRef<VideoSlot>(0);
  const filmIndexRef = useRef(0);
  const transitioning = useRef(false);
  const transitionTimer = useRef<number | null>(null);
  const [activeSlot, setActiveSlot] = useState<VideoSlot>(0);
  const [slotSources, setSlotSources] = useState<[string, string]>([FILMS[0], FILMS[1]]);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(([entry]) => {
      inView.current = entry.isIntersecting;
      const activeVideo = activeSlotRef.current === 0 ? firstVideoRef.current : secondVideoRef.current;
      const inactiveVideo = activeSlotRef.current === 0 ? secondVideoRef.current : firstVideoRef.current;
      if (!activeVideo) return;
      if (entry.isIntersecting && !userPaused.current) {
        activeVideo.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      } else {
        activeVideo.pause();
        inactiveVideo?.pause();
        setPlaying(false);
      }
    }, { threshold: .01, rootMargin: "300px 0px" });
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
    };
  }, []);

  const advanceFilm = async (completedSlot: VideoSlot) => {
    if (completedSlot !== activeSlotRef.current || transitioning.current || !inView.current || userPaused.current) return;
    transitioning.current = true;

    const nextSlot: VideoSlot = completedSlot === 0 ? 1 : 0;
    const nextIndex = (filmIndexRef.current + 1) % FILMS.length;
    const nextVideo = nextSlot === 0 ? firstVideoRef.current : secondVideoRef.current;
    const completedVideo = completedSlot === 0 ? firstVideoRef.current : secondVideoRef.current;

    if (!nextVideo) {
      transitioning.current = false;
      return;
    }

    nextVideo.currentTime = 0;
    try {
      await nextVideo.play();
      if (!inView.current || userPaused.current) {
        nextVideo.pause();
        transitioning.current = false;
        return;
      }
      filmIndexRef.current = nextIndex;
      activeSlotRef.current = nextSlot;
      setActiveSlot(nextSlot);
      setPlaying(true);

      transitionTimer.current = window.setTimeout(() => {
        completedVideo?.pause();
        const followingIndex = (nextIndex + 1) % FILMS.length;
        setSlotSources((current) => {
          const updated: [string, string] = [...current];
          updated[completedSlot] = FILMS[followingIndex];
          return updated;
        });
        transitioning.current = false;
      }, 950);
    } catch {
      transitioning.current = false;
      setPlaying(false);
    }
  };

  const togglePlayback = () => {
    const video = activeSlotRef.current === 0 ? firstVideoRef.current : secondVideoRef.current;
    if (!video) return;
    if (video.paused) {
      userPaused.current = false;
      video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      userPaused.current = true;
      firstVideoRef.current?.pause();
      secondVideoRef.current?.pause();
      setPlaying(false);
    }
  };

  return <motion.div ref={containerRef} className="treatment-film" initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .25 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}>
    <video ref={firstVideoRef} src={slotSources[0]} className={`treatment-film-video${activeSlot === 0 ? " active" : ""}`} muted playsInline preload="auto" aria-label="Traditional Ayurvedic treatment experience" onEnded={() => void advanceFilm(0)} />
    <video ref={secondVideoRef} src={slotSources[1]} className={`treatment-film-video${activeSlot === 1 ? " active" : ""}`} muted playsInline preload="auto" aria-hidden={activeSlot !== 1} onEnded={() => void advanceFilm(1)} />
    <div className="treatment-film-shade" />
    <div className="treatment-film-copy"><span>The practice</span><h3>Ancient care, thoughtfully experienced.</h3><p>A glimpse into the therapies, attention and unhurried rhythm behind an Ayurvedic retreat.</p></div>
    <MagneticButton type="button" className="film-control" onClick={togglePlayback} ariaLabel={playing ? "Pause treatment video" : "Play treatment video"}>{playing ? "Ⅱ" : "▶"}</MagneticButton>
  </motion.div>;
}
