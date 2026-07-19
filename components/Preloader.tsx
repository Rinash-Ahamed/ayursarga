"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

export default function Preloader({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 1600);
    return () => window.clearTimeout(timer);
  }, []);

  return <AnimatePresence onExitComplete={onDone}>
    {visible && <motion.div id="preloader" exit={{ opacity: 0 }} transition={{ duration: .65, ease: "easeOut" }}>
      <motion.div className="pre-logo" initial={{ opacity: 0, scale: .82 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}>
        <Image src="/mainlogo.png" alt="Ayursarga" width={280} height={280} priority />
      </motion.div>
    </motion.div>}
  </AnimatePresence>;
}
