import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Ayursarga Consumer App",
  robots: { index: false, follow: false },
};

/** Route boundary reserved for consumer discovery and booking features. */
export default function ConsumerLayout({ children }: { children: ReactNode }) {
  return children;
}
