import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ROUTES } from "@/config/routes";

export function AuthFormShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return <main className="portal-auth-shell">
    <Link href={ROUTES.public.home} className="portal-brand" aria-label="Return to Ayursarga home">
      <Image src="/mainlogo.png" alt="" width={52} height={52} quality={90} sizes="52px" priority />
      <span>Ayursarga</span>
    </Link>
    <section className="portal-auth-card" aria-labelledby="portal-auth-title">
      <span className="portal-eyebrow">{eyebrow}</span>
      <h1 id="portal-auth-title">{title}</h1>
      <p className="portal-auth-description">{description}</p>
      {children}
    </section>
    <Link href={ROUTES.public.home} className="portal-return">← Return to the public website</Link>
  </main>;
}
