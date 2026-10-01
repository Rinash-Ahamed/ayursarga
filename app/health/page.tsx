import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createApiHealthReport } from "@/services/api/server";
import { isContactEmailReady } from "@/services/contact/contactEmailService";
import { isFirebaseAdminReady } from "@/services/firebase/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "System Status | Ayursarga",
  description: "Current availability of Ayursarga platform services.",
  robots: { index: false, follow: false },
};

const dependencyLabels: Record<string, { title: string; description: string }> = {
  "firebase-admin": {
    title: "Platform services",
    description: "Secure account and application data services.",
  },
  "contact-email": {
    title: "Contact support",
    description: "Delivery of contact and guidance requests.",
  },
};

export default function HealthPage() {
  const report = createApiHealthReport("/api/health", [
    { name: "firebase-admin", ready: isFirebaseAdminReady() },
    { name: "contact-email", ready: isContactEmailReady() },
  ]);
  const isHealthy = report.status === "ok";

  return <main className="health-page">
    <section className="health-card" aria-labelledby="health-title">
      <header className="health-header">
        <Link className="health-brand" href="/" aria-label="Ayursarga home">
          <Image src="/mainlogo.png" alt="" width={52} height={52} priority />
          <span>Ayursarga</span>
        </Link>
        <span className="health-live-label"><i aria-hidden="true" />Live status</span>
      </header>

      <div className="health-summary">
        <span className="health-summary-icon" data-status={report.status} aria-hidden="true">
          {isHealthy ? "✓" : "!"}
        </span>
        <div>
          <p className="health-kicker">System health</p>
          <h1 id="health-title">{isHealthy ? "All services are ready" : "Some services need attention"}</h1>
          <p>{isHealthy
            ? "Ayursarga's essential platform services are configured and available."
            : "The website remains available, but one or more supporting services are not fully configured."}</p>
        </div>
      </div>

      <div className="health-services" aria-label="Service status">
        {report.dependencies.map((dependency) => {
          const content = dependencyLabels[dependency.name] ?? {
            title: dependency.name,
            description: "Ayursarga supporting service.",
          };
          return <article className="health-service" key={dependency.name}>
            <div>
              <h2>{content.title}</h2>
              <p>{content.description}</p>
            </div>
            <span className="health-status" data-status={dependency.status}>
              <i aria-hidden="true" />{dependency.status === "ready" ? "Available" : "Unavailable"}
            </span>
          </article>;
        })}
      </div>

      <footer className="health-footer">
        <p>Last checked <time dateTime={report.checkedAt}>{new Date(report.checkedAt).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Asia/Kolkata",
        })}</time></p>
        <Link href="/">Return to Ayursarga</Link>
      </footer>
    </section>
  </main>;
}
