import type { HospitalDocument } from "@/features/firestore/models";
import { resolveCentreGuidelines } from "@/features/hospitals/guidelines";

export function CentreGuidelineFields({ hospital }: { hospital: HospitalDocument }) {
  return <><fieldset className="full portal-guidelines-fieldset">
    <legend>Centre guidelines</legend>
    <p className="portal-form-note">These guidelines appear in the centre details shown to consumers. You may adapt the wording to your centre’s policy.</p>
    <div className="portal-guidelines-fields">
      {resolveCentreGuidelines(hospital).map((guideline, index) => <label key={guideline.id}>
        {index + 1}. {guideline.title}
        <textarea name={`centreGuideline_${guideline.id}`} defaultValue={guideline.body} maxLength={1_200} required />
      </label>)}
      <label>
        12. Other centre-specific rules
        <textarea
          name="additionalCentreRules"
          defaultValue={hospital.additionalCentreRules ?? ""}
          maxLength={4_000}
          placeholder="Add any other rules specific to your centre."
        />
      </label>
    </div>
  </fieldset>
  <fieldset className="full portal-guidelines-fieldset">
    <legend>Facilities and policies</legend>
    <p className="portal-form-note">Add one facility per line, then include any centre-specific legal or policy information consumers should review.</p>
    <div className="portal-guidelines-fields">
      <label>Facilities
        <textarea name="facilities" defaultValue={hospital.facilities ?? ""} maxLength={4_000} placeholder={"Private rooms\nMother and baby care support\nAyurvedic therapy rooms"} />
      </label>
      <label>Legal and policies
        <textarea name="legalPolicies" defaultValue={hospital.legalPolicies ?? ""} maxLength={4_000} placeholder="Add centre-specific legal terms, cancellation information, or policies." />
      </label>
    </div>
  </fieldset></>;
}
