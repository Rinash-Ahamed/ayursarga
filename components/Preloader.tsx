"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Preloader({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence onExitComplete={onDone}>
      {visible && (
        <motion.div
          id="preloader"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <svg className="pre-mark" viewBox="0 0 200 200" fill="none">
            <path
              d="M100 20 C130 60 145 100 120 150 C112 165 88 165 80 150 C55 100 70 60 100 20 Z"
              stroke="#A88E75"
              strokeWidth="2"
            />
          </svg>
          <span className="pre-word">Ayursarga</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
