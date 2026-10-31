import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { platformHealthReport } from "@/services/api/platformHealth";
import { formatDisplayDateTime } from "@/utils/date";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "System Status | Ayursarga",
  description: "Current availability of Ayursarga platform services.",
  robots: { index: false, follow: false },
};

const dependencyLabels: Record<string, { title: string; description: string }> = {
  "firebase-admin": {
    title: "Platform services",
    description: "Server SDK configuration for account and application services.",
  },
  "contact-email": {
    title: "Contact support",
    description: "Email sender configuration for contact and guidance requests.",
  },
  "auth-email": { title: "Invitations & password resets", description: "Firebase Admin, email sender and password-link return URL configuration." },
  "firebase-client": { title: "Browser sign-in", description: "Required Firebase Web SDK configuration is present." },
  "hospital-images": { title: "Hospital image uploads", description: "Server SDK and Storage bucket configuration." },
  "consultation-payments": { title: "Consultation payments", description: "Server payment and webhook configuration only; not proof of capture, delivery or settlement." },
};

export default async function HealthPage({ searchParams }: { searchParams: Promise<{ deep?: string }> }) {
  const deep = (await searchParams).deep === "true";
  const report = platformHealthReport(deep);
  const isHealthy = report.status === "ok";

  return <main className="health-page">
    <section className="health-card" aria-labelledby="health-title">
      <header className="health-header">
        <Link className="health-brand" href="/" aria-label="Ayursarga home">
          <Image src="/mainlogo.png" alt="" width={52} height={52} priority />
          <span>Ayursarga</span>
        </Link>
        <span className="health-live-label"><i aria-hidden="true" />{deep ? "Expanded checks" : "Configuration"}</span>
      </header>

      <div className="health-summary">
        <span className="health-summary-icon" data-status={report.status} aria-hidden="true">
          {isHealthy ? "✓" : "!"}
        </span>
        <div>
          <p className="health-kicker">System health</p>
          <h1 id="health-title">{isHealthy ? "Configuration checks passed" : "Some settings need attention"}</h1>
          <p>{isHealthy
            ? "The checked platform settings are configured. Live service connectivity and delivery have not been tested."
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
              <i aria-hidden="true" />{dependency.status === "ready" ? "Configured" : "Not configured"}
            </span>
          </article>;
        })}
      </div>

      <div className="health-footer">
        <p>This check does not send emails, read or change records, verify deployed permissions, or test every API.</p>
      </div>
      <footer className="health-footer">
        <div><p>Last checked <time dateTime={report.checkedAt}>{formatDisplayDateTime(report.checkedAt)}</time></p>
          <Link href={deep ? "/health" : "/health?deep=true"}>{deep ? "Show essential checks" : "Show expanded configuration checks"}</Link></div>
        <Link href="/">Return to Ayursarga</Link>
      </footer>
    </section>
  </main>;
}
