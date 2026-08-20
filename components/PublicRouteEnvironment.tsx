"use client";

import { useEffect, type ReactNode } from "react";

export default function PublicRouteEnvironment({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.body.classList.remove("loading");
  }, []);

  return children;
}
