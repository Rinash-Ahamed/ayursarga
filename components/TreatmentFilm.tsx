"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export default function TreatmentFilm() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const userPaused = useRef(false);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !userPaused.current) {
        video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      } else {
        video.pause();
        setPlaying(false);
      }
    }, { threshold: .3 });
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      userPaused.current = false;
      video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      userPaused.current = true;
      video.pause();
      setPlaying(false);
    }
  };

  return <motion.div className="treatment-film" initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .25 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}>
    <video ref={videoRef} muted loop playsInline autoPlay preload="metadata" aria-label="Traditional Ayurvedic treatment experience">
      <source src="/ayurvedic-treatment.mp4" type="video/mp4" />
    </video>
    <div className="treatment-film-shade" />
    <div className="treatment-film-copy"><span>The practice</span><h3>Ancient care, thoughtfully experienced.</h3><p>A glimpse into the therapies, attention and unhurried rhythm behind an Ayurvedic retreat.</p></div>
    <button type="button" className="film-control" onClick={togglePlayback} aria-label={playing ? "Pause treatment video" : "Play treatment video"}>{playing ? "Ⅱ" : "▶"}</button>
  </motion.div>;
}
