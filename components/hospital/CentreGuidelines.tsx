import type { HospitalDocument } from "@/features/firestore/models";
import { resolveCentreGuidelines } from "@/features/hospitals/guidelines";
import { groupHospitalFacilities } from "@/features/hospitals/facilities";
import { FacilityIcon } from "@/components/icons/FacilityIcon";

export function CentreGuidelines({ hospital }: { hospital: HospitalDocument }) {
  const guidelines = resolveCentreGuidelines(hospital);
  const additionalRules = hospital.additionalCentreRules?.trim();
  const { groups: facilityGroups, custom: customFacilities, hasFacilities } = groupHospitalFacilities(hospital.facilities);
  const legalPolicies = hospital.legalPolicies?.trim();
  const locationUrl = hospital.locationUrl?.trim();

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
    <div className="centre-profile-information">
      <section aria-labelledby="centre-facilities-title">
        <div className="centre-profile-information-heading">
          <span>Hospital submitted</span>
          <h3 id="centre-facilities-title">Facilities</h3>
        </div>
        {hasFacilities ? <div className="centre-facility-summary">
          {facilityGroups.map((group) => <div key={group.title}>
            <strong>{group.title}</strong>
            <ul>{group.options.map((option) => <li key={option}><FacilityIcon facility={option} /><span>{option}</span></li>)}</ul>
          </div>)}
          {customFacilities.length > 0 && <div>
            <strong>Other facilities</strong>
            <ul>{customFacilities.map((facility, index) => <li key={`${facility}-${index}`}><FacilityIcon facility={facility} /><span>{facility}</span></li>)}</ul>
          </div>}
        </div> : <p className="centre-profile-empty">No facilities have been submitted.</p>}
      </section>

      <section aria-labelledby="centre-policies-title">
        <div className="centre-profile-information-heading">
          <span>Hospital submitted</span>
          <h3 id="centre-policies-title">Legal and policies</h3>
        </div>
        {legalPolicies
          ? <p className="centre-profile-policy">{legalPolicies}</p>
          : <p className="centre-profile-empty">No centre-specific legal or policy information has been submitted.</p>}
        {locationUrl && <a className="centre-profile-location" href={locationUrl} target="_blank" rel="noreferrer">View centre location</a>}
      </section>
    </div>
  </section>;
}
