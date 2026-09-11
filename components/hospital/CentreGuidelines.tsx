import type { HospitalDocument } from "@/features/firestore/models";
import { resolveCentreGuidelines } from "@/features/hospitals/guidelines";

export function CentreGuidelines({ hospital }: { hospital: HospitalDocument }) {
  const guidelines = resolveCentreGuidelines(hospital);
  const additionalRules = hospital.additionalCentreRules?.trim();

  return <section className="portal-card centre-guidelines" aria-labelledby="centre-guidelines-title">
    <div className="centre-guidelines-heading">
      <span>Before your stay</span>
      <h2 id="centre-guidelines-title">Centre guidelines</h2>
      <p>Please review these guidelines before visiting or staying at the centre.</p>
    </div>
    <ol className="centre-guidelines-list">
      {guidelines.map((guideline) => <li key={guideline.id}>
        <div><strong>{guideline.title}</strong><p>{guideline.body}</p></div>
      </li>)}
      {additionalRules && <li>
        <div><strong>Additional Centre Rules</strong><p className="centre-guidelines-additional">{additionalRules}</p></div>
      </li>}
    </ol>
  </section>;
}
