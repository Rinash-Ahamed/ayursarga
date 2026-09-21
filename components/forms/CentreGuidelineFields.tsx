import type { HospitalDocument } from "@/features/firestore/models";
import { resolveCentreGuidelines } from "@/features/hospitals/guidelines";
import { HOSPITAL_FACILITY_GROUPS, resolveHospitalFacilities } from "@/features/hospitals/facilities";
import { FacilityIcon } from "@/components/icons/FacilityIcon";

export function CentreGuidelineFields({ hospital }: { hospital: HospitalDocument }) {
  const facilities = resolveHospitalFacilities(hospital.facilities);

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
    <p className="portal-form-note">Select every facility available at your centre. These details will be visible to consumers.</p>
    <div className="portal-guidelines-fields">
      <div className="portal-facility-groups full">
        {HOSPITAL_FACILITY_GROUPS.map((group) => <fieldset className="portal-facility-group" key={group.title}>
          <legend>{group.title}</legend>
          <div className="portal-facility-options">
            {group.options.map((option) => <label className="portal-facility-option" key={option}>
              <input
                type="checkbox"
                name="facilityOption"
                value={option}
                defaultChecked={facilities.selected.has(option)}
              />
              <FacilityIcon facility={option} />
              <span>{option}</span>
            </label>)}
          </div>
        </fieldset>)}
      </div>
      <label>Other facilities
        <textarea name="customFacilities" defaultValue={facilities.custom} maxLength={4_000} placeholder="Add one additional facility per line." />
      </label>
      <label>Legal and policies
        <textarea name="legalPolicies" defaultValue={hospital.legalPolicies ?? ""} maxLength={4_000} placeholder="Add centre-specific legal terms, cancellation information, or policies." />
      </label>
    </div>
  </fieldset></>;
}
